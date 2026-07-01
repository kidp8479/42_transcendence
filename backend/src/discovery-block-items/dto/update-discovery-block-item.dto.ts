// All fields are optional - the caller can update only one field at a time.
// discoveryBlockId is not here: you never move an item from one block to another.
// isChecked is the main use case - checking or unchecking an item.

export class UpdateDiscoveryBlockItemDto {
  label?: string;
  isChecked?: boolean;
}
