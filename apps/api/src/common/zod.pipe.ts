import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common'
import { z } from 'zod'
@Injectable()
export class ZodPipe implements PipeTransform {
  constructor(private readonly schema: z.ZodType) {}
  transform(value: unknown) {
    const result = this.schema.safeParse(value)
    if (!result.success) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: '请求参数不合法', details: result.error.flatten() })
    return result.data
  }
}
