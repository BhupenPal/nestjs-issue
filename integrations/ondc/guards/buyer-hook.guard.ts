import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class BuyerHookGuard implements CanActivate {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    const isValidWebhook = this.validateWebhook(request);

    return isValidWebhook;
  }

  private validateWebhook(request: any): boolean {
    if (!request) return false;

    return true;
  }
}
