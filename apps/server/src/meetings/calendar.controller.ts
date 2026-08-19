import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  Patch,
} from "@nestjs/common";
import { CalendarService } from "./calendar.service";
import { SupabaseGuard } from "../core/guards/supabase.guard";
import { CreateEventDto } from "./dtos/create-event.dto";
import { UpdateEventDto } from "./dtos/update-event.dto";

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
  };
}

@Controller("calendar")
@UseGuards(SupabaseGuard)
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Post()
  async createEvent(@Req() req: AuthenticatedRequest, @Body() body: CreateEventDto) {
    return this.calendarService.createEvent(req.user.id, body);
  }

  @Get("search")
  async searchEvents(
    @Req() req: AuthenticatedRequest,
    @Query("q") query: string,
  ) {
    console.log(`[Backend Search API] User: ${req.user.id}, Keyword: "${query}"`);
    const result = await this.calendarService.searchEvents(req.user.id, query);
    console.log(`[Backend Search API] Found ${result.length} results`);
    return {
      code: 200,
      message: "Tìm kiếm lịch họp thành công",
      result,
    };
  }

  @Get()
  async getEvents(
    @Req() req: AuthenticatedRequest,
    @Query("start") start: string,
    @Query("end") end: string,
    @Query("roomId") roomId?: string,
    @Query("createdByMe") createdByMe?: string,
  ) {
    return this.calendarService.getEventsForUser(req.user.id, start, end, {
      roomId,
      createdByMe: createdByMe === "true",
    });
  }

  @Put(":id")
  async updateEvent(
    @Req() req: AuthenticatedRequest,
    @Param("id") eventId: string,
    @Query("type") updateType: "single" | "all" = "all",
    @Query("occurrenceDate") occurrenceDate?: string,
    @Body() body: UpdateEventDto = {},
  ) {
    return this.calendarService.updateEvent(req.user.id, eventId, updateType, body, occurrenceDate);
  }

  @Delete(":id")
  async deleteEvent(
    @Req() req: AuthenticatedRequest,
    @Param("id") eventId: string,
    @Query("type") deleteType: "single" | "all" = "all",
    @Query("occurrenceDate") occurrenceDate?: string,
  ) {
    return this.calendarService.deleteEvent(req.user.id, eventId, deleteType, occurrenceDate);
  }

  @Patch(":id/rsvp")
  async updateRSVP(
    @Req() req: AuthenticatedRequest,
    @Param("id") eventId: string,
    @Body("status") status: "ACCEPTED" | "DECLINED" | "TENTATIVE",
  ) {
    return this.calendarService.updateRSVP(req.user.id, eventId, status);
  }

  @Get(":id/rsvp")
  async getRSVPList(@Param("id") eventId: string) {
    return this.calendarService.getRSVPList(eventId);
  }
}
