export type HarvestPledgeCategory = 'harvest-appeal' | 'harvest-sales';
export type HarvestPledgeGroup = 'Men' | 'Women' | 'Youth' | 'Day Born' | 'Main';

export interface HarvestPledge {
  id: string;
  memberID: string;
  memberName: string;
  classNumber: string;
  date: string; // ISO format YYYY-MM-DD
  amount: number;
  remaining: number;
  category: HarvestPledgeCategory;
  group?: HarvestPledgeGroup;
  note?: string;
  createdBy?: string;
  updatedBy?: string;
  lastUpdated?: string;
  deleted?: boolean;
  createdAt?: string;
}

export interface HarvestPledgePayment {
  id: string;
  pledgeId: string;
  paymentDate: string; // ISO format YYYY-MM-DD
  amount: number;
  entryId?: string; // Reference to the financial entry created
  paidBy?: string;
  notes?: string;
  createdAt?: string;
}
