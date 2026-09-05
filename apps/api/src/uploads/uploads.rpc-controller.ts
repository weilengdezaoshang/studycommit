import { Controller, Inject, Req, UseGuards } from '@nestjs/common'
import { Implement, implement } from '@orpc/nest'
import { uploadsContract } from '@studycommit/rpc-contracts/uploads'
import type { AuthedRequest } from '../auth/identity.guard'
import { IdentityGuard } from '../auth/identity.guard'
import { handleOrpc } from '../common/orpc-error'
import { UploadsService } from './uploads.service'

@Controller()
@UseGuards(IdentityGuard)
export class UploadsRpcController {
  constructor(@Inject(UploadsService) private readonly uploads: UploadsService) {}

  @Implement(uploadsContract)
  uploadsRouter(@Req() request: AuthedRequest) {
    return {
      create: implement(uploadsContract.create).handler(({ input }) =>
        handleOrpc(() => this.uploads.createUpload(request.userId, input)),
      ),
      complete: implement(uploadsContract.complete).handler(({ input }) =>
        handleOrpc(() => this.uploads.completeUpload(request.userId, input.uploadId)),
      ),
      remove: implement(uploadsContract.remove).handler(({ input }) =>
        handleOrpc(() => this.uploads.removeUpload(request.userId, input.uploadId)),
      ),
      access: implement(uploadsContract.access).handler(({ input }) =>
        handleOrpc(() => this.uploads.accessAsset(request.userId, input.id)),
      ),
    }
  }
}
