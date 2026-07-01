// All fields are optional - the caller can update only one field at a time.
// discoveryBlockId is not here: you never move an item from one block to another.
// isChecked is the main use case - checking or unchecking an item.
// order is updated here when the user drags and drops to reorder items.

export class UpdateDiscoveryBlockItemDto {
  label?: string;
  isChecked?: boolean;
  order?: number;
}
