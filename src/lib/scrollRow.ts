// When a row in Målinger is clicked, the list must stay where it is. Only a selection made elsewhere (on the
// drawing) scrolls the matching row into view. A click on a row is told apart by a pointerdown in a table row.
let lastRowPress = 0;

if (typeof document !== 'undefined') {
  document.addEventListener(
    'pointerdown',
    (e) => {
      if (e.target instanceof Element && e.target.closest('tr[data-room-row], tr[data-wall-row], tr[data-opening-row]')) lastRowPress = Date.now();
    },
    true,
  );
}

/** Scrolls the row into view, unless the selection came from clicking in the table itself. */
export function scrollRowIntoView(selector: string) {
  if (Date.now() - lastRowPress < 1000) return;
  document.querySelector(selector)?.scrollIntoView({ block: 'nearest' });
}
