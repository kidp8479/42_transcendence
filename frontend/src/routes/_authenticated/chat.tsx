// Chat page (/chat) - group chat per project (ProjectMember.count > 1, a
// project with a single member has no one to talk to). The conversation
// list on the left comes from the same project list the sidebar already
// loads (@/lib/projectsApi's Project.memberCount) - no extra request for it.
// Bubble layout follows Flowbite's chat-bubble pattern
// (https://flowbite.com/docs/components/chat-bubble/), rebuilt here with
// plain Tailwind since flowbite-react has no ChatBubble component of its
// own - Button/Textarea below are the real flowbite-react imports.
import { useEffect, useRef, useState } from "react";
import { createFileRoute, useLoaderData } from "@tanstack/react-router";
import { Button, Textarea } from "flowbite-react";
import { HiOutlineTrash } from "react-icons/hi2";
import { IoArrowBack, IoSend } from "react-icons/io5";
import {
  fetchChatMessages,
  createChatMessage,
  deleteChatMessage,
  markChatRead,
  parseChatMessage,
  CHAT_MESSAGE_CONTENT_MAX_LENGTH,
  type ChatMessage,
} from "@/lib/chatApi";
import { getMembers, type ProjectMember } from "@/lib/projectMembersApi";
import { LockOwnerAvatar } from "@/components/LockOwnerAvatar";
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
  // Below md, the conversation list and the open chat can't fit
  // side-by-side, so only one shows at a time - this tracks which, with a
  // back button in the chat header to return to the list. Ignored at md+,
  // where both panes are always visible regardless of its value.
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");
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
  // Announced text for the visually hidden live region below the message
  // list - only set for messages that actually arrive over the socket while
  // the page is open, never for the initial page load or "load earlier
  // history", so screen reader users hear new messages without also getting
  // an entire history dump read out on every navigation.
  const [liveAnnouncement, setLiveAnnouncement] = useState("");
  useLiveItemSync(
    "chat",
    parseChatMessage,
    setMessages,
    {
      value: selectedProjectId ?? "",
      getValue: (message) => message.projectId,
    },
    (message) => {
      const author = message.author?.username ?? "Deleted user";
      setLiveAnnouncement(`${author}: ${message.content}`);
      // Same read-watermark logic as the initial-load effect below - a
      // message arriving live while this conversation is the one on screen
      // is just as "read" as one fetched on open, but nothing else re-fires
      // markChatRead for it (this callback only runs for genuinely new,
      // in-scope messages, never for our own echo or a different
      // conversation) - without this, the server-side watermark goes stale
      // the moment a live message lands, and reappears as unread on reload
      // or another device even though the user was looking right at it.
      markChatRead(message.projectId, {
        id: message.id,
        createdAt: message.createdAt,
      }).catch(() => {
        // best-effort - a background refetch of /chat/unread will
        // eventually reconcile if this fails
      });
    }
  );

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
        // explicit mark-read action (see ChatService.markRead), only fired
        // once the fetched page has actually landed in state above - clear
        // the dot immediately client-side too instead of waiting on the
        // unread store's next background refetch. The watermark sent is the
        // newest message actually in this fetched page (fetchedMessages is
        // oldest-first, so the last entry), not "now" - a message from
        // someone else could otherwise land between this GET and the PATCH
        // below and get marked read despite never being rendered.
        chatUnreadResource.markRead(selectedProjectId);
        const newestFetched = fetchedMessages[fetchedMessages.length - 1];
        markChatRead(
          selectedProjectId,
          newestFetched
            ? { id: newestFetched.id, createdAt: newestFetched.createdAt }
            : undefined
        ).catch(() => {
          // best-effort - a background refetch of /chat/unread will
          // eventually reconcile if this fails
        });
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
    const projectId = selectedProjectId;
    if (!projectId || messages.length === 0) return;
    setLoadingMore(true);
    try {
      const older = await fetchChatMessages(projectId, {
        before: messages[0].id,
        beforeCreatedAt: messages[0].createdAt,
        take: MESSAGES_PAGE_SIZE,
      });
      // the user may have switched conversations while this was in flight -
      // `messages`/`hasMoreHistory` now belong to a different conversation,
      // and prepending this response there would be wrong (same bug class
      // as handleSend/handleDelete's own staleness guards)
      if (projectId === selectedProjectId) {
        setMessages((previous) => [...older, ...previous]);
        setHasMoreHistory(older.length === MESSAGES_PAGE_SIZE);
      }
    } catch {
      showToast({ type: "error", message: "Could not load earlier messages." });
    } finally {
      // loadingMore isn't scoped per-conversation - always clear it so a
      // conversation switched into isn't stuck showing "Loading..." for a
      // fetch that belonged to the one left behind
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
      // restore the failed content, but only by prepending it to whatever's
      // already in the box - if the user kept typing while the request was
      // in flight, that new text is real work and must not be clobbered
      setDraft((current) => (current ? `${content} ${current}` : content));
      showToast({ type: "error", message: "Message could not be sent." });
    } finally {
      setSending(false);
    }
  }

  async function handleDelete(message: ChatMessage) {
    const projectId = selectedProjectId;
    if (!projectId) return;
    setMessages((previous) => previous.filter((m) => m.id !== message.id));
    try {
      await deleteChatMessage(projectId, message.id);
    } catch {
      // only splice the message back in if its own conversation is still
      // the one on screen - if the user has since switched away, `messages`
      // now holds a different conversation's list and this message doesn't
      // belong in it
      if (projectId === selectedProjectId) {
        setMessages((previous) =>
          previous.some((m) => m.id === message.id)
            ? previous
            : [...previous, message].sort((a, b) =>
                a.createdAt.localeCompare(b.createdAt)
              )
        );
      }
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
        <aside
          className={`w-full shrink-0 overflow-y-auto border-r border-surface-border md:block md:w-72 ${
            mobileView === "chat" ? "hidden" : "block"
          }`}
        >
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
                onClick={() => {
                  setSelectedProjectId(project.id);
                  setMobileView("chat");
                }}
              />
            ))
          )}
        </aside>

        <section
          // min-w-0: without it, this flex item's default min-width:auto
          // lets an unbroken long message (no spaces to wrap on) force this
          // whole pane wider than its allotted space instead of wrapping -
          // same root cause the message bubble's own min-w-0 already
          // documents below, one level up the flex chain.
          className={`min-h-0 min-w-0 flex-1 flex-col md:flex ${
            mobileView === "list" ? "hidden" : "flex"
          }`}
        >
          {!activeConversation ? (
            <div className="flex flex-1 items-center justify-center text-sm text-text-secondary">
              Select a conversation to start chatting.
            </div>
          ) : (
            <>
              <header className="flex items-center justify-between border-b border-surface-border px-4 py-4 sm:px-6">
                <div className="flex min-w-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setMobileView("list")}
                    aria-label="Back to conversations"
                    className="-ml-1 shrink-0 p-1 text-text-secondary hover:text-text-primary md:hidden"
                  >
                    <IoArrowBack className="h-5 w-5" />
                  </button>
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-semibold text-text-primary">
                      {activeConversation.name}
                    </h2>
                    <p className="text-xs text-text-secondary">
                      {activeConversation.memberCount} members
                    </p>
                  </div>
                </div>
                <div className="shrink-0">
                  <AvatarStack
                    assignees={members.map((member) => member.user)}
                    maxVisible={AVATAR_STACK_MAX_DISPLAYED}
                  />
                </div>
              </header>

              {/* visually hidden - announces messages that arrive live over
                  the socket to screen readers; see the liveAnnouncement
                  comment above for why it's not the whole message list */}
              <div aria-live="polite" aria-atomic="true" className="sr-only">
                {liveAnnouncement}
              </div>

              <div className="min-w-0 flex-1 space-y-6 overflow-y-auto px-4 py-4 sm:px-6">
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

              <div className="flex items-end gap-2 border-t border-surface-border px-3 py-3 sm:px-4 sm:py-4">
                <Textarea
                  rows={1}
                  aria-label="Write a message"
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
                  <IoSend className="h-5 w-5" />
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
      aria-current={active ? "true" : undefined}
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
              role="img"
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
      <LockOwnerAvatar
        username={username}
        avatarUrl={message.author?.avatarUrl ?? null}
        size="sm"
      />
      <div
        // min-w-0: flex items default to min-width:auto (their content's
        // natural width), which overrides max-w-[85%]/max-w-[70%] below for
        // one long unbroken run of text - min-w-0 lets this shrink to the
        // available space instead, which is what actually allows the
        // message div's own wrapping to kick in.
        className={`flex min-w-0 max-w-[85%] flex-col gap-1 sm:max-w-[70%] ${isSelf ? "items-end" : "items-start"}`}
      >
        <div className="flex items-center gap-2 text-xs text-text-secondary">
          <span className="font-semibold text-text-primary">{username}</span>
          <span>{formatTime(message.createdAt)}</span>
        </div>
        <div
          // max-w-full: this row's own column parent uses items-end/items-start
          // (not stretch), so it never gets a width imposed on it from above -
          // without max-w-full here too, this row (and the message div's own
          // max-w-full inside it) has nothing definite to resolve a percentage
          // against, and free-sizes to the unwrapped message's full content
          // width instead of respecting the pane.
          className="flex min-w-0 max-w-full items-center gap-2"
        >
          {isSelf && (
            <button
              type="button"
              onClick={onDelete}
              aria-label="Delete message"
              // Always in the DOM and focusable - only visually dimmed at
              // sm+ until hovered/focused (opacity, not display:none/hidden)
              // so a keyboard-only user can still Tab to it and delete their
              // own messages, not just a mouse user hovering the bubble.
              className="text-text-muted opacity-100 transition-colors hover:text-control-error focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
            >
              <HiOutlineTrash className="h-4 w-4" />
            </button>
          )}
          <div
            // whitespace-pre-wrap keeps the author's newlines instead of
            // collapsing them to spaces like normal HTML text flow does;
            // [overflow-wrap:anywhere] (break-words alone isn't enough for
            // one long unbroken run with no spaces at all, ex: a pasted
            // hash/URL) is what stops a single long token from forcing the
            // whole bubble - and the chat pane around it - wider than the
            // viewport instead of wrapping.
            className={`min-w-0 max-w-full whitespace-pre-wrap break-words rounded-xl px-4 py-2 text-sm leading-relaxed [overflow-wrap:anywhere] ${
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
