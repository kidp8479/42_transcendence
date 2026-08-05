// Chat page (/chat) - group chat per project (ProjectMember.count > 1, a
// project with a single member has no one to talk to). The conversation
// list on the left comes from the same project list the sidebar already
// loads (@/lib/projectsApi's Project.memberCount) - no extra request for it.
// Bubble layout follows Flowbite's chat-bubble pattern
// (https://flowbite.com/docs/components/chat-bubble/), rebuilt here with
// plain Tailwind since flowbite-react has no ChatBubble component of its
// own - Avatar/Button/Textarea below are the real flowbite-react imports.
import { useEffect, useRef, useState } from "react";
import { createFileRoute, useLoaderData } from "@tanstack/react-router";
import { Avatar, Button, Textarea } from "flowbite-react";
import { HiOutlinePaperAirplane, HiOutlineTrash } from "react-icons/hi2";
import {
  fetchChatMessages,
  createChatMessage,
  deleteChatMessage,
  parseChatMessage,
  CHAT_MESSAGE_CONTENT_MAX_LENGTH,
  type ChatMessage,
} from "@/lib/chatApi";
import { getMembers, type ProjectMember } from "@/lib/projectMembersApi";
import { authSessionResource } from "@/lib/authState";
import { chatUnreadResource } from "@/lib/chatUnreadState";
import { useLiveItemSync } from "@/hooks/useLiveItemSync";
import { useChatUnread } from "@/hooks/useChatUnread";
import { useToast } from "@/hooks/useToast";
import { darkSurfaceFieldClassName } from "@/lib/flowbite";
import { AvatarStack } from "@/components/common/AvatarStack";

export const Route = createFileRoute("/_authenticated/chat")({
  component: ChatPage,
});

// A page of history at a time - matches the backend's own default
// (CHAT_MESSAGES_DEFAULT_PAGE_SIZE), kept here just for the "Load earlier
// messages" button's own page-size request.
const MESSAGES_PAGE_SIZE = 50;

function initialsOf(username: string) {
  return username.slice(0, 2).toUpperCase();
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ChatPage() {
  // Same project list the sidebar already loaded at the _authenticated
  // layout boundary (see route.tsx's loader) - only projects with more than
  // one member are a chat (a solo project has no one to talk to).
  const projects = useLoaderData({ from: "/_authenticated" });
  const conversations = projects.filter((project) => project.memberCount > 1);

  const authState = authSessionResource.getState();
  const currentUserId =
    authState?.status === "authenticated" ? authState.session.user.id : null;

  const { showToast } = useToast();
  const unreadProjectIds = useChatUnread();

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    conversations[0]?.id ?? null
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMoreHistory, setHasMoreHistory] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const AVATAR_STACK_MAX_DISPLAYED = 12;

  // Real-time: another member's new/deleted message updates this page
  // without a reload. Scoped to the open conversation only - value "" (no
  // conversation selected yet) can never match a real projectId, so nothing
  // leaks in before a conversation is chosen.
  useLiveItemSync("chat", parseChatMessage, setMessages, {
    value: selectedProjectId ?? "",
    getValue: (message) => message.projectId,
  });

  // Tells the unread store which conversation is on screen, so a message
  // landing here while the user is looking at it never lights up its dot -
  // cleared on unmount (leaving the Chat page) so a later message can flag
  // it again once nobody's actively viewing it.
  useEffect(() => {
    chatUnreadResource.setActiveProjectId(selectedProjectId);
    return () => {
      chatUnreadResource.setActiveProjectId(null);
    };
  }, [selectedProjectId]);

  useEffect(() => {
    if (!selectedProjectId) {
      setMessages([]);
      setMembers([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetchChatMessages(selectedProjectId, { take: MESSAGES_PAGE_SIZE }),
      getMembers(selectedProjectId),
    ])
      .then(([fetchedMessages, fetchedMembers]) => {
        if (cancelled) return;
        setMessages(fetchedMessages);
        setHasMoreHistory(fetchedMessages.length === MESSAGES_PAGE_SIZE);
        setMembers(fetchedMembers);
        // this GET is what marks the conversation read backend-side (see
        // ChatService.findAll) - clear its dot immediately instead of
        // waiting on the unread store's next background refetch
        chatUnreadResource.markRead(selectedProjectId);
      })
      .catch(() => {
        if (cancelled) return;
        showToast({ type: "error", message: "Could not load this chat." });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- showToast is stable
  }, [selectedProjectId]);

  // Only auto-scroll to the newest message on first load / when a new
  // message comes in at the bottom - not after prepending older history,
  // which would otherwise yank the view back down mid-scroll-up.
  useEffect(() => {
    if (!loadingMore) {
      messagesEndRef.current?.scrollIntoView({ block: "end" });
    }
  }, [messages.length, loadingMore]);

  async function handleLoadEarlier() {
    if (!selectedProjectId || messages.length === 0) return;
    setLoadingMore(true);
    try {
      const older = await fetchChatMessages(selectedProjectId, {
        before: messages[0].id,
        take: MESSAGES_PAGE_SIZE,
      });
      setMessages((previous) => [...older, ...previous]);
      setHasMoreHistory(older.length === MESSAGES_PAGE_SIZE);
    } catch {
      showToast({ type: "error", message: "Could not load earlier messages." });
    } finally {
      setLoadingMore(false);
    }
  }

  async function handleSend() {
    const content = draft.trim();
    const projectId = selectedProjectId;
    if (!content || !projectId || sending) return;
    setSending(true);
    setDraft("");
    try {
      const created = await createChatMessage(projectId, content);
      if (projectId !== selectedProjectId) return; // meanwhile conversation changed
      setMessages((previous) =>
        previous.some((m) => m.id === created.id)
          ? previous
          : [...previous, created]
      );
    } catch {
      setDraft(content);
      showToast({ type: "error", message: "Message could not be sent." });
    } finally {
      setSending(false);
    }
  }

  async function handleDelete(message: ChatMessage) {
    if (!selectedProjectId) return;
    setMessages((previous) => previous.filter((m) => m.id !== message.id));
    try {
      await deleteChatMessage(selectedProjectId, message.id);
    } catch {
      setMessages((previous) =>
        previous.some((m) => m.id === message.id)
          ? previous
          : [...previous, message].sort((a, b) =>
              a.createdAt.localeCompare(b.createdAt)
            )
      );
      showToast({ type: "error", message: "Message could not be deleted." });
    }
  }

  const activeConversation = conversations.find(
    (project) => project.id === selectedProjectId
  );

  return (
    // h-[calc(100vh-134px)], not h-full: <main> (AuthenticatedLayout) has no
    // hard-capped height of its own (page scrolls normally by design there),
    // so h-full would resolve against nothing and the whole document would
    // scroll instead of just the message list below. Same viewport-relative
    // constant SideBarCmp pins itself to (header+footer chrome, ~133px) -
    // +1px here because that constant backs a `sticky` element there, which
    // silently tolerates being a pixel short/tall (just a hairline gap).
    // This div instead hard-clips (overflow-hidden) the real document height,
    // so the same 133px undershooting by a pixel left the page exactly one
    // pixel taller than the viewport - just enough to trigger the browser's
    // vertical scrollbar. overflow-hidden keeps this root from ever growing
    // past its bound, so only the flex-1 message list (overflow-y-auto
    // further down) scrolls - header and input bar stay put.
    <div className="flex h-[calc(100vh-134px)] min-h-0 flex-col overflow-hidden">
      <div className="mb-2 border-b border-surface-border p-6">
        <h1 className="font-mono text-xl font-bold text-text-primary">Chat</h1>
        <p className="text-xs text-text-secondary">
          Group chats for every project you share with at least one teammate.
        </p>
      </div>

      <div className="flex min-h-0 flex-1">
        <aside className="w-72 shrink-0 overflow-y-auto border-r border-surface-border">
          {conversations.length === 0 ? (
            <p className="p-4 text-xs text-text-secondary">
              No group chats yet - join or create a project with at least one
              other member to start one.
            </p>
          ) : (
            conversations.map((project) => (
              <ConversationRow
                key={project.id}
                name={project.name}
                memberCount={project.memberCount}
                active={project.id === selectedProjectId}
                hasUnread={unreadProjectIds.has(project.id)}
                onClick={() => setSelectedProjectId(project.id)}
              />
            ))
          )}
        </aside>

        <section className="flex min-h-0 flex-1 flex-col">
          {!activeConversation ? (
            <div className="flex flex-1 items-center justify-center text-sm text-text-secondary">
              Select a conversation to start chatting.
            </div>
          ) : (
            <>
              <header className="flex items-center justify-between border-b border-surface-border px-6 py-4">
                <div>
                  <h2 className="text-sm font-semibold text-text-primary">
                    {activeConversation.name}
                  </h2>
                  <p className="text-xs text-text-secondary">
                    {activeConversation.memberCount} members
                  </p>
                </div>
                <div className="flex -space-x-2">
                  <AvatarStack
                    assignees={members.map((member) => member.user)}
                    maxVisible={AVATAR_STACK_MAX_DISPLAYED}
                  />
                </div>
              </header>

              <div className="flex-1 space-y-6 overflow-y-auto px-6 py-4">
                {loading ? (
                  <p className="text-center text-xs text-text-secondary">
                    Loading messages...
                  </p>
                ) : (
                  <>
                    {hasMoreHistory && (
                      <div className="flex justify-center">
                        <button
                          type="button"
                          onClick={handleLoadEarlier}
                          disabled={loadingMore}
                          className="text-xs font-medium text-brand-500 hover:underline disabled:opacity-50"
                        >
                          {loadingMore ? "Loading..." : "Load earlier messages"}
                        </button>
                      </div>
                    )}
                    {messages.length === 0 ? (
                      <p className="text-center text-xs text-text-secondary">
                        No messages yet. Say hi!
                      </p>
                    ) : (
                      messages.map((message) => (
                        <ChatBubble
                          key={message.id}
                          message={message}
                          isSelf={message.author?.id === currentUserId}
                          onDelete={() => handleDelete(message)}
                        />
                      ))
                    )}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              <div className="flex items-end gap-3 border-t border-surface-border px-6 py-4">
                <Textarea
                  rows={1}
                  placeholder="Write a message..."
                  className={`flex-1 resize-none ${darkSurfaceFieldClassName}`}
                  maxLength={CHAT_MESSAGE_CONTENT_MAX_LENGTH}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void handleSend();
                    }
                  }}
                />
                <Button
                  color="success"
                  disabled={draft.trim().length === 0 || sending}
                  onClick={() => void handleSend()}
                >
                  <HiOutlinePaperAirplane className="h-5 w-5 rotate-90" />
                </Button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function ConversationRow({
  name,
  memberCount,
  active,
  hasUnread,
  onClick,
}: {
  name: string;
  memberCount: number;
  active: boolean;
  hasUnread: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 border-b border-surface-border px-4 py-3 text-left transition-colors hover:bg-surface-overlay ${
        active ? "bg-surface-overlay" : ""
      }`}
    >
      <div className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-text-primary">
            {name}
          </span>
          {hasUnread && (
            <span
              aria-label="Unread messages"
              className="h-2 w-2 shrink-0 rounded-full bg-control-error"
            />
          )}
        </span>
        <span className="block text-xs text-text-secondary">
          {memberCount} members
        </span>
      </div>
    </button>
  );
}

function ChatBubble({
  message,
  isSelf,
  onDelete,
}: {
  message: ChatMessage;
  isSelf: boolean;
  onDelete: () => void;
}) {
  const username = message.author?.username ?? "Deleted user";
  return (
    <div
      className={`group flex items-start gap-3 ${isSelf ? "flex-row-reverse" : ""}`}
    >
      <Avatar
        img={message.author?.avatarUrl ?? undefined}
        placeholderInitials={initialsOf(username)}
        rounded
        size="sm"
      />
      <div
        className={`flex max-w-[70%] flex-col gap-1 ${isSelf ? "items-end" : "items-start"}`}
      >
        <div className="flex items-center gap-2 text-xs text-text-secondary">
          <span className="font-semibold text-text-primary">{username}</span>
          <span>{formatTime(message.createdAt)}</span>
        </div>
        <div className="flex items-center gap-2">
          {isSelf && (
            <button
              type="button"
              onClick={onDelete}
              aria-label="Delete message"
              className="hidden text-text-muted transition-colors hover:text-control-error group-hover:block"
            >
              <HiOutlineTrash className="h-4 w-4" />
            </button>
          )}
          <div
            className={`rounded-xl px-4 py-2 text-sm leading-relaxed ${
              isSelf
                ? "rounded-tr-none bg-brand-600 text-white"
                : "rounded-tl-none bg-surface-overlay text-text-primary"
            }`}
          >
            {message.content}
          </div>
        </div>
      </div>
    </div>
  );
}
