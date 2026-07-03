// CalendarLabelsService: handles all database operations for CalendarLabels
// called by the controller, never called directly by the frontend

import { Injectable } from "@nestjs/common";

@Injectable()
export class CalendarLabelsService {
  // all methods below will use PrismaService to query the database
  // none of these are called directly by the frontend - always via the controller
  // TODO: inject PrismaService here via constructor
  // the constructor is called automatically by NestJS at startup - never called manually
  // TODO: create(projectId: string, dto: CreateCalendarLabelDto)
  //       => insert a new calendar label in the database, linked to projectId from the URL
  // TODO: findAll(projectId: string)
  //       => fetch all calendar labels belonging to a given project
  // TODO: findById(id: string)
  //       => fetch one calendar label by its id
  // TODO: update(id: string, dto: UpdateCalendarLabelDto)
  //       => update a label (name or color)
  // TODO: remove(id: string)
  //       => permanently delete a calendar label
}
