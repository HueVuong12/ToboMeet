import { Global, Module } from "@nestjs/common";
import { SchedulerClientService } from "./scheduler-client.service";

@Global()
@Module({
  providers: [SchedulerClientService],
  exports: [SchedulerClientService],
})
export class SchedulerClientModule {}
