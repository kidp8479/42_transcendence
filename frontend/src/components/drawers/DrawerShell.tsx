// Base container for all drawers.
// A drawer is a slide-in panel from the right side of the screen, used to show
// the detail view of an item (kanban card, list task, calendar event) without
// navigating away from the current page.
//
// DrawerShell handles the shared visual structure:
// - Slide-in animation from the right
// - Overlay/backdrop behind the panel
// - Close button and click-outside-to-close behavior
// - Scroll area for long content
//
// It does NOT know what content it displays.
// Each specific drawer (KanBanCardDrawer, ListItemDrawer...) renders inside it.
//
// Similar in concept to ModalLayer, but a drawer anchors to the side rather
// than centering on screen.
