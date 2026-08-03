// Chat page (/chat) - static markup only, no engine yet.
// One chat per group project (ProjectMember.count > 1) - a project with a
// single member has no one to talk to, so it never appears in the
// conversation list (see projectsApi.ts's Project.memberCount).
// Bubble layout follows Flowbite's chat-bubble pattern
// (https://flowbite.com/docs/components/chat-bubble/), rebuilt here with
// plain Tailwind since flowbite-react has no ChatBubble component of its
// own - Avatar/Button/Textarea below are the real flowbite-react imports.
import { createFileRoute } from "@tanstack/react-router";
import { Avatar, Button, Textarea } from "flowbite-react";
import { HiOutlinePaperAirplane } from "react-icons/hi2";

export const Route = createFileRoute("/_authenticated/chat")({
  component: ChatPage,
});

interface MockMember {
  username: string;
  avatarUrl: string | null;
}

interface MockMessage {
  id: string;
  author: MockMember;
  isSelf: boolean;
  time: string;
  text: string;
}

interface MockConversation {
  id: string;
  projectName: string;
  members: MockMember[];
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
}

const mockConversations: MockConversation[] = [
  {
    id: "1",
    projectName: "Transcendence",
    members: [
      { username: "chgajean", avatarUrl: null },
      { username: "amartin", avatarUrl: null },
      { username: "ldurand", avatarUrl: null },
    ],
    lastMessage: "ldurand: I pushed the fix for the field locks",
    lastMessageTime: "10:42",
    unreadCount: 2,
  },
  {
    id: "2",
    projectName: "Vault Migration",
    members: [
      { username: "chgajean", avatarUrl: null },
      { username: "sbernard", avatarUrl: null },
    ],
    lastMessage: "sbernard: sounds good, see you tomorrow",
    lastMessageTime: "09:15",
    unreadCount: 0,
  },
  {
    id: "3",
    projectName: "Onboarding Revamp",
    members: [
      { username: "chgajean", avatarUrl: null },
      { username: "amartin", avatarUrl: null },
      { username: "jrivet", avatarUrl: null },
      { username: "pmoreau", avatarUrl: null },
    ],
    lastMessage: "You: let's sync on the discovery blocks",
    lastMessageTime: "Yesterday",
    unreadCount: 0,
  },
];

const activeConversation = mockConversations[0];

const mockMessages: MockMessage[] = [
  {
    id: "m1",
    author: { username: "amartin", avatarUrl: null },
    isSelf: false,
    time: "10:21",
    text: "Anyone else seeing the discovery block save twice on reconnect?",
  },
  {
    id: "m2",
    author: { username: "chgajean", avatarUrl: null },
    isSelf: true,
    time: "10:24",
    text: "Yeah, saw it too. Looks like it's the field lock re-acquire on the second tab.",
  },
  {
    id: "m3",
    author: { username: "ldurand", avatarUrl: null },
    isSelf: false,
    time: "10:40",
    text: "Got it, digging into field-lock-manager.ts now.",
  },
  {
    id: "m4",
    author: { username: "ldurand", avatarUrl: null },
    isSelf: false,
    time: "10:42",
    text: "I pushed the fix for the field locks, can someone review?",
  },
];

function initialsOf(username: string) {
  return username.slice(0, 2).toUpperCase();
}

function ChatPage() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-2 border-b border-surface-border p-6">
        <h1 className="font-mono text-xl font-bold text-text-primary">Chat</h1>
        <p className="text-xs text-text-secondary">
          Group chats for every project you share with at least one teammate.
        </p>
      </div>

      <div className="flex min-h-0 flex-1">
        <aside className="w-72 shrink-0 overflow-y-auto border-r border-surface-border">
          {mockConversations.map((conversation) => (
            <ConversationRow
              key={conversation.id}
              conversation={conversation}
              active={conversation.id === activeConversation.id}
            />
          ))}
        </aside>

        <section className="flex min-h-0 flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-surface-border px-6 py-4">
            <div>
              <h2 className="text-sm font-semibold text-text-primary">
                {activeConversation.projectName}
              </h2>
              <p className="text-xs text-text-secondary">
                {activeConversation.members.length} members
              </p>
            </div>
            <div className="flex -space-x-2">
              {activeConversation.members.map((member) => (
                <Avatar
                  key={member.username}
                  img={member.avatarUrl ?? undefined}
                  placeholderInitials={initialsOf(member.username)}
                  rounded
                  size="sm"
                  className="ring-2 ring-surface-raised"
                />
              ))}
            </div>
          </header>

          <div className="flex-1 space-y-6 overflow-y-auto px-6 py-4">
            {mockMessages.map((message) => (
              <ChatBubble key={message.id} message={message} />
            ))}
          </div>

          <div className="flex items-end gap-3 border-t border-surface-border px-6 py-4">
            <Textarea
              rows={1}
              placeholder="Write a message..."
              className="flex-1 resize-none"
            />
            <Button color="success">
              <HiOutlinePaperAirplane className="h-5 w-5 rotate-90" />
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}

function ConversationRow({
  conversation,
  active,
}: {
  conversation: MockConversation;
  active: boolean;
}) {
  return (
    <button
      type="button"
      className={`flex w-full items-center gap-3 border-b border-surface-border px-4 py-3 text-left transition-colors hover:bg-surface-overlay ${
        active ? "bg-surface-overlay" : ""
      }`}
    >
      <div className="flex -space-x-3">
        {conversation.members.slice(0, 3).map((member) => (
          <Avatar
            key={member.username}
            img={member.avatarUrl ?? undefined}
            placeholderInitials={initialsOf(member.username)}
            rounded
            size="sm"
            className="ring-2 ring-surface-raised"
          />
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <span className="truncate text-sm font-semibold text-text-primary">
            {conversation.projectName}
          </span>
          <span className="shrink-0 text-[11px] text-text-secondary">
            {conversation.lastMessageTime}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-xs text-text-secondary">
            {conversation.lastMessage}
          </p>
          {conversation.unreadCount > 0 && (
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-600 text-[11px] font-semibold text-white">
              {conversation.unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function ChatBubble({ message }: { message: MockMessage }) {
  return (
    <div
      className={`flex items-start gap-3 ${message.isSelf ? "flex-row-reverse" : ""}`}
    >
      <Avatar
        img={message.author.avatarUrl ?? undefined}
        placeholderInitials={initialsOf(message.author.username)}
        rounded
        size="sm"
      />
      <div
        className={`flex max-w-[70%] flex-col gap-1 ${message.isSelf ? "items-end" : "items-start"}`}
      >
        <div className="flex items-center gap-2 text-xs text-text-secondary">
          <span className="font-semibold text-text-primary">
            {message.author.username}
          </span>
          <span>{message.time}</span>
        </div>
        <div
          className={`rounded-xl px-4 py-2 text-sm leading-relaxed ${
            message.isSelf
              ? "rounded-tr-none bg-brand-600 text-white"
              : "rounded-tl-none bg-surface-overlay text-text-primary"
          }`}
        >
          {message.text}
        </div>
      </div>
    </div>
  );
}
