CREATE ROLE "{{name}}" WITH LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}';
GRANT USAGE ON SCHEMA public TO "{{name}}";
GRANT SELECT ON TABLE "User" TO "{{name}}";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  "Notification",
  "ProjectMember",
  "Project",
  "TaskCategory",
  "TaskAssignee",
  "Task",
  "CalendarCategory",
  "CalendarAssignee",
  "CalendarEvent",
  "DiscoveryBlock",
  "DiscoveryBlockItem",
  "EvaluationChecklistItem"
TO "{{name}}";
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO "{{name}}";
