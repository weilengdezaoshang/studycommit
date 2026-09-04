import { Controller, Headers, Inject, UnauthorizedException } from '@nestjs/common'
import { Implement, implement } from '@orpc/nest'
import { authContract } from '@studycommit/rpc-contracts/auth'
import { handleOrpc } from '../common/orpc-error'
import { AUTH_ERROR } from './auth.constants'
import { AuthService } from './auth.service'

@Controller()
export class AuthRpcController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Implement(authContract)
  authRouter(@Headers('authorization') authorization: string | undefined) {
    return {
      sendPhoneCode: implement(authContract.sendPhoneCode).handler(({ input }) =>
        handleOrpc(() => this.auth.sendPhoneCode(input.phone)),
      ),
      verifyPhone: implement(authContract.verifyPhone).handler(({ input }) =>
        handleOrpc(() => this.auth.verifyPhone(input)),
      ),
      registerAccount: implement(authContract.registerAccount).handler(({ input }) =>
        handleOrpc(() => this.auth.registerAccount(input)),
      ),
      loginAccount: implement(authContract.loginAccount).handler(({ input }) =>
        handleOrpc(() => this.auth.loginAccount(input)),
      ),
      loginWechatMiniprogram: implement(authContract.loginWechatMiniprogram).handler(({ input }) =>
        handleOrpc(() => this.auth.loginWechatMiniprogram(input.code)),
      ),
      refreshToken: implement(authContract.refreshToken).handler(({ input }) =>
        handleOrpc(() => this.auth.refresh(input.refreshToken)),
      ),
      logout: implement(authContract.logout).handler(() =>
        handleOrpc(() => this.auth.logout(requireBearerToken(authorization))),
      ),
      me: implement(authContract.me).handler(() =>
        handleOrpc(() => this.auth.me(requireBearerToken(authorization))),
      ),
    }
  }
}

function requireBearerToken(header: string | string[] | undefined): string {
  const value = Array.isArray(header) ? header[0] : header
  const token = /^Bearer (.+)$/.exec(value ?? '')?.[1]
  if (!token) {
    throw new UnauthorizedException(AUTH_ERROR.unauthenticated)
  }
  return token
}
