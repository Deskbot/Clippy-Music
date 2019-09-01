import { UserRecord } from "../lib/UserRecord";
import { MakeOnce } from "../lib/MakeOnce";

export const UserRecordServiceGetter = new (class extends MakeOnce<UserRecord> {
	make(): UserRecord {
		return new UserRecord(UserRecord.recover());
	}
})();