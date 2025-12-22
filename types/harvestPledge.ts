export type HarvestPledgeCategory = 'harvest-appeal' | 'harvest-sales';

export interface HarvestPledge {
  id: string;
  memberID: string;
  memberName: string;
  classNumber: string;
  date: string; // ISO format YYYY-MM-DD
  amount: number;
  remaining: number;
  category: HarvestPledgeCategory;
  note?: string;
  createdBy?: string;
  updatedBy?: string;
  lastUpdated?: string;
  deleted?: boolean;
  createdAt?: string;
}
