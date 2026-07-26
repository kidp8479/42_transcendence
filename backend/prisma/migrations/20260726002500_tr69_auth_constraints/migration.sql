-- AddConstraint
ALTER TABLE "RefreshTokenFamily"
	ADD CONSTRAINT "RefreshTokenFamily_assuranceLevel_positive_chk" CHECK ("assuranceLevel" > 0),
	ADD CONSTRAINT "RefreshTokenFamily_idle_before_absolute_chk" CHECK ("idleExpiresAt" <= "absoluteExpiresAt"),
	ADD CONSTRAINT "RefreshTokenFamily_revocation_reason_requires_revoked_at_chk" CHECK ("revokedReason" IS NULL OR "revokedAt" IS NOT NULL);

-- AddConstraint
ALTER TABLE "AuthRefreshToken"
	ADD CONSTRAINT "AuthRefreshToken_expiry_after_issue_chk" CHECK ("expiresAt" > "issuedAt"),
	ADD CONSTRAINT "AuthRefreshToken_used_after_issue_chk" CHECK ("usedAt" IS NULL OR "usedAt" >= "issuedAt"),
	ADD CONSTRAINT "AuthRefreshToken_replaced_after_issue_chk" CHECK ("replacedAt" IS NULL OR "replacedAt" >= "issuedAt"),
	ADD CONSTRAINT "AuthRefreshToken_grace_after_issue_chk" CHECK ("graceExpiresAt" IS NULL OR "graceExpiresAt" >= "issuedAt");

-- AddConstraint
ALTER TABLE "OAuthTransaction"
	ADD CONSTRAINT "OAuthTransaction_expiry_after_created_chk" CHECK ("expiresAt" > "createdAt"),
	ADD CONSTRAINT "OAuthTransaction_consumed_after_created_chk" CHECK ("consumedAt" IS NULL OR "consumedAt" >= "createdAt");

-- AddConstraint
ALTER TABLE "WebSocketTicket"
	ADD CONSTRAINT "WebSocketTicket_expiry_after_issue_chk" CHECK ("expiresAt" > "issuedAt"),
	ADD CONSTRAINT "WebSocketTicket_consumed_after_issue_chk" CHECK ("consumedAt" IS NULL OR "consumedAt" >= "issuedAt");
