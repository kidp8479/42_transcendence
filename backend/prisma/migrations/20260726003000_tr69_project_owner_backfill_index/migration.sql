-- Backfill
WITH ranked_admins AS (
	SELECT
		id,
		ROW_NUMBER() OVER (
			PARTITION BY "projectId"
			ORDER BY "createdAt" ASC, id ASC
		) AS rank_in_project
	FROM "ProjectMember"
	WHERE role = 'ADMIN'
)
UPDATE "ProjectMember"
SET role = 'OWNER'
WHERE id IN (
	SELECT id
	FROM ranked_admins
	WHERE rank_in_project = 1
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectMember_projectId_owner_unique"
ON "ProjectMember" ("projectId")
WHERE role = 'OWNER';
