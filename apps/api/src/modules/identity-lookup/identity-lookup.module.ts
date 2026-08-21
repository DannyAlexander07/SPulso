import { Module } from '@nestjs/common';
import { IdentityLookupController } from './identity-lookup.controller';
import { IdentityLookupService } from './identity-lookup.service';

@Module({
  controllers: [IdentityLookupController],
  providers: [IdentityLookupService],
})
export class IdentityLookupModule {}
