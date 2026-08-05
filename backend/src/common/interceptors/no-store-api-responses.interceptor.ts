import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Observable } from "rxjs";

@Injectable()
export class NoStoreApiResponsesInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<{ originalUrl?: string; url?: string }>();
    const path = (request.originalUrl ?? request.url ?? "").split("?")[0];
    if (
      path.startsWith("/api/public/v1/") ||
      /^\/api\/projects\/[^/]+\/api-tokens(?:\/|$)/.test(path)
    ) {
      http.getResponse().setHeader("Cache-Control", "no-store");
    }
    return next.handle();
  }
}
