export const CHAT_MESSAGE_CONTENT_MAX_LENGTH = 4000;

// default/cap for GET pagination - mirrors the "max N per request" pattern
// used elsewhere (e.g. EVALUATION_CHECKLIST_MAX_ITEMS_PER_SECTION) so a
// client can't ask for the whole history in one query.
export const CHAT_MESSAGES_DEFAULT_PAGE_SIZE = 50;
export const CHAT_MESSAGES_MAX_PAGE_SIZE = 100;
