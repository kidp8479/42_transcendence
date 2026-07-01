generator;
client;
{
    provider = "prisma-client-js";
}
datasource;
db;
{
    provider = "postgresql";
    url = env("DATABASE_URL");
}
model;
User;
{
    id;
    String;
    (uuid());
    email;
    String;
    username;
    String;
    avatarUrl;
    String ?
        createdAt : ;
    DateTime;
    (now());
    updatedAt;
    DateTime;
    projectMembers;
    ProjectMember[];
}
model;
ProjectMember;
{
    id;
    String;
    (uuid());
    userId;
    String;
    projectId;
    String;
    user;
    User;
    project;
    Project;
}
model;
Project;
{
    id;
    String;
    (uuid());
    name;
    String;
    description;
    String ?
        isCompleted : ;
    Boolean;
    (false);
    createdAt;
    DateTime;
    (now());
    updatedAt;
    DateTime;
    members;
    ProjectMember[];
    tasks;
    Task[];
    calendarEvents;
    CalendarEvent[];
    discoveryBlocks;
    DiscoveryBlock[];
    evaluationChecklistItems;
    EvaluationChecklistItem[];
}
model;
Task;
{
    id;
    String;
    (uuid());
    createdAt;
    DateTime;
    (now());
    updatedAt;
    DateTime;
    title;
    String;
    status;
    String;
    category;
    Integer;
    priority;
    Integer;
    projectId;
    String;
    startAt;
    DateTime ?
        endAt : ;
    DateTime ?
        tag : ;
    String ?
        description : ;
    String ?
        notes : ;
    String ?
        :
    ;
}
model;
CalendarEvent;
{
}
model;
DiscoveryBlock;
{
}
model;
EvaluationChecklistItem;
{
}
//# sourceMappingURL=schema.prisma.js.map