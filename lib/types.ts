export interface ShowListing {
  date: string;
  club: string;
  show: string;
  resultUrl: string;
}

export interface ShowResult {
  id: string;
  showDate: string;
  showName: string;
  breed: string;
  pcciNo: string;
  dogName?: string;
  points: number;
  placement?: string;
  createdAt: string;
}

export interface SearchFilters {
  breed?: string;
  showDateFrom?: string;
  showDateTo?: string;
  pcciNo?: string;
}

export interface TallyRow {
  pcciNo: string;
  dogName?: string;
  breed?: string;
  totalPoints: number;
  resultCount: number;
  results: ShowResult[];
}
