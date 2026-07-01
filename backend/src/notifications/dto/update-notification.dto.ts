// All fields are optional - the caller can update only one field at a time.
// The only update case for a notification is marking it as read.
// userId and message are not here: you never change who a notification belongs to or its content.

export class UpdateNotificationDto {
  isRead?: boolean;
}
