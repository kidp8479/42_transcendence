-- The previous refresh token retains only an authenticated encryption of its
-- successor for the five-second idempotency grace. Auth clears expired
-- ciphertext during later rotations; retries outside grace remain replay
-- detections.
ALTER TABLE "AuthRefreshToken"
ADD COLUMN "successorCiphertext" TEXT;

CREATE INDEX "AuthRefreshToken_graceExpiresAt_idx"
ON "AuthRefreshToken"("graceExpiresAt");
