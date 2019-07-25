import { UserRecord } from '../lib/UserRecord.js';

export const UserRecordService = new UserRecord(UserRecord.recover());
