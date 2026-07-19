import type { DatabaseService } from '@main/services/database/databaseService';

export class JobService {
  constructor(private readonly databaseService: DatabaseService) {}

  public listJobs() {
    return this.databaseService.listQueue();
  }

  public createDemoJob(projectId: string) {
    return this.databaseService.createDemoJob(projectId);
  }
}
