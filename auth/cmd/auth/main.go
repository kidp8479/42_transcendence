package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/42london/42_transcendence/auth/internal/config"
	"github.com/42london/42_transcendence/auth/internal/password"
	"github.com/42london/42_transcendence/auth/internal/server"
	"github.com/42london/42_transcendence/auth/internal/store"
	"github.com/42london/42_transcendence/auth/internal/vault"
	"github.com/jackc/pgx/v5/pgxpool"
)

const poolDrainTimeout = 30 * time.Second

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatal(err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	authStore := store.New(nil)
	runtime, err := vault.NewRuntime(vault.RuntimeConfig{
		Address:      cfg.VaultAddress,
		RoleIDFile:   cfg.VaultRoleIDFile,
		SecretIDFile: cfg.VaultSecretIDFile,
		DatabaseRole: cfg.VaultDatabaseRole,
	}, func(ctx context.Context, credentials vault.DatabaseCredentials) error {
		pool, err := pgxpool.New(ctx, vault.DatabaseURL(
			cfg.VaultDatabaseHost,
			cfg.VaultDatabasePort,
			cfg.VaultDatabaseName,
			credentials,
		))
		if err != nil {
			return err
		}
		if err := pool.Ping(ctx); err != nil {
			pool.Close()
			return err
		}
		previous := authStore.ReplacePool(pool)
		if previous != nil {
			go func() {
				timer := time.NewTimer(poolDrainTimeout)
				defer timer.Stop()
				<-timer.C
				previous.Close()
			}()
		}
		return nil
	})
	if err != nil {
		log.Fatalf("create Vault runtime: %v", err)
	}
	secrets, err := runtime.Start(ctx)
	if err != nil {
		log.Fatalf("start Vault runtime: %v", err)
	}
	defer func() {
		if pool := authStore.ReplacePool(nil); pool != nil {
			pool.Close()
		}
	}()

	passwords := password.NewHasher()
	cfg.InternalToken = secrets.InternalToken
	handler, err := server.NewWithReadiness(cfg, authStore, passwords, runtime.Ready)
	if err != nil {
		log.Fatalf("create auth server: %v", err)
	}
	httpServer := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           handler,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	errCh := make(chan error, 1)
	runtimeCtx, runtimeCancel := context.WithCancel(context.Background())
	defer runtimeCancel()
	go runtime.Run(runtimeCtx)
	go func() {
		log.Printf("auth service listening on :%s", cfg.Port)
		errCh <- httpServer.ListenAndServe()
	}()

	signals := make(chan os.Signal, 1)
	signal.Notify(signals, syscall.SIGINT, syscall.SIGTERM)

	select {
	case sig := <-signals:
		log.Printf("received %s, shutting down", sig)
	case err := <-errCh:
		if !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("serve auth service: %v", err)
		}
		return
	}

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()
	if err := httpServer.Shutdown(shutdownCtx); err != nil {
		log.Printf("graceful shutdown failed: %v", err)
	}
}
