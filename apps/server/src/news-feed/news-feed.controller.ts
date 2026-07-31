import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Query,
  Param,
  UseGuards,
  Req,
  BadRequestException,
} from "@nestjs/common";
import { SupabaseGuard } from "../core/guards/supabase.guard";
import { NewsFeedService } from "./news-feed.service";
import { CreatePostDto } from "./dto/create-post.dto";
import { CreateCommentDto } from "./dto/create-comment.dto";
import { Request } from "express";

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
  };
}

interface AttachmentInput {
  url: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  thumbnail?: string;
}

@Controller("news-feed")
@UseGuards(SupabaseGuard)
export class NewsFeedController {
  constructor(private readonly newsFeedService: NewsFeedService) {}

  @Get("posts")
  async getPosts(
    @Query("roomId") roomId: string,
    @Query("channelId") channelId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<unknown[]> {
    if (!roomId || !channelId) {
      throw new BadRequestException("roomId và channelId là bắt buộc");
    }
    const userId = req.user.id;
    return this.newsFeedService.getPosts(roomId, channelId, userId);
  }

  @Post("posts")
  async createPost(@Body() dto: CreatePostDto, @Req() req: AuthenticatedRequest) {
    const userId = req.user.id;
    return this.newsFeedService.createPost(userId, dto);
  }

  @Patch("posts/:id")
  async updatePost(
    @Param("id") id: string,
    @Body("content") content: string,
    @Body("attachments") attachments: AttachmentInput[],
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user.id;
    return this.newsFeedService.updatePost(userId, id, content, attachments);
  }

  @Delete("posts/:id")
  async deletePost(@Param("id") id: string, @Req() req: AuthenticatedRequest) {
    const userId = req.user.id;
    return this.newsFeedService.deletePost(userId, id);
  }

  @Post("posts/:id/reactions")
  async togglePostReaction(
    @Param("id") id: string,
    @Body("type") type: string,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!type) {
      throw new BadRequestException("Reaction type là bắt buộc");
    }
    const userId = req.user.id;
    return this.newsFeedService.togglePostReaction(userId, id, type);
  }

  @Get("posts/:id/reactions")
  async getPostReactions(@Param("id") id: string, @Req() req: AuthenticatedRequest) {
    const userId = req.user.id;
    return this.newsFeedService.getPostReactions(id, userId);
  }

  @Post("posts/signed-url")
  async createSignedUploadUrl(@Body("fileName") fileName: string) {
    if (!fileName) {
      throw new BadRequestException("fileName là bắt buộc");
    }
    return this.newsFeedService.createSignedUploadUrl(fileName);
  }

  @Get("posts/:postId/comments")
  async getComments(@Param("postId") postId: string, @Req() req: AuthenticatedRequest) {
    const userId = req.user.id;
    return this.newsFeedService.getComments(postId, userId);
  }

  @Post("comments")
  async createComment(@Body() dto: CreateCommentDto, @Req() req: AuthenticatedRequest) {
    const userId = req.user.id;
    return this.newsFeedService.createComment(userId, dto);
  }

  @Patch("comments/:id")
  async updateComment(
    @Param("id") id: string,
    @Body("content") content: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user.id;
    return this.newsFeedService.updateComment(userId, id, content);
  }

  @Delete("comments/:id")
  async deleteComment(@Param("id") id: string, @Req() req: AuthenticatedRequest) {
    const userId = req.user.id;
    return this.newsFeedService.deleteComment(userId, id);
  }

  @Post("comments/:id/reactions")
  async toggleCommentReaction(
    @Param("id") id: string,
    @Body("type") type: string,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!type) {
      throw new BadRequestException("Reaction type là bắt buộc");
    }
    const userId = req.user.id;
    return this.newsFeedService.toggleCommentReaction(userId, id, type);
  }
}
