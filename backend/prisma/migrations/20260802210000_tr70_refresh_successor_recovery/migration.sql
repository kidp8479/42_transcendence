-- The previous refresh token retains only an authenticated encryption of its
-- successor for the five-second idempotency grace. No raw refresh token is
-- persisted, and retries outside the grace remain replay detections.
ALTER TABLE "AuthRefreshToken"
ADD COLUMN "successorCiphertext" TEXT;
