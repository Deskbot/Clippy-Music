import { IdFactory } from '../lib/IdFactory';
import { MakeOnce } from '../lib/MakeOnce';

export const IdFactoryServiceGetter = new (class extends MakeOnce<IdFactory> {
    make(): IdFactory {
        return new IdFactory(IdFactory.restore());
    }
})();
