-- WebSocket tickets have one fixed consumer. Keeping the audience constraint
-- in PostgreSQL prevents a future caller from broadening a ticket in storage.
ALTER TABLE "WebSocketTicket"
	ADD CONSTRAINT "WebSocketTicket_fixed_audience_chk"
	CHECK ("audience" = 'transcendence-ws'),
	ADD CONSTRAINT "WebSocketTicket_sha256_hash_chk"
	CHECK (char_length("ticketHash") = 64);
