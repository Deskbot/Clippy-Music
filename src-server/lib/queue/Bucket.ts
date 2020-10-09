import * as arrayUtils from "../utils/arrayUtils";
import * as utils from "../utils/utils";

import { ItemData } from "../../types/ItemData";
import { UniqueArray } from "../utils/UniqueArray";

export class Bucket implements Iterable<ItemData> {
    private items: ItemData[];
    private itemsNeedReordering = false;
    private users: UniqueArray<string>;

    constructor(initialItems: ItemData[] = []) {
        this.items = initialItems;

        this.users = new UniqueArray<string>(
            initialItems.map(item => item.userId)
        );
    }

    get content(): ItemData[] {
        this.enforceOrder();
        return [...this.items];
    }

    destroyAllFromUser(userId: string) {
        this.itemsNeedReordering = true;
        arrayUtils.removeAll(this.items, item => item.userId === userId);
    }

    destroyItem(contentId: number): boolean {
        this.itemsNeedReordering = true;

        const itemPos = this.items.findIndex(item => item.id === contentId);
        const item = this.items[itemPos];

        const removedItems = this.items.splice(itemPos, 1);
        const didRemove = removedItems.length > 0;

        if (didRemove) {
            this.removeUserIfTheyHaveNoItems(item.userId);
        }

        return didRemove;
    }

    private enforceOrder() {
        if (!this.itemsNeedReordering) {
            return;
        }

        const memoisedPriorities = utils.mapFrom(this.items, item => this.priority(item));

        this.items = [...this.items].sort((left, right) => {
            return memoisedPriorities.get(left)! - memoisedPriorities.get(right)!;
        });

        this.itemsNeedReordering = false;
    }

    get length(): number {
        return this.items.length;
    }

    outputFrontItem(): ItemData | undefined {
        this.enforceOrder();
        const output = this.items.shift();

        if (output !== undefined) {
            // put user to the back of the queue
            while (true) {
                const nextUser = this.users.shift();
                if (nextUser === output.userId) {
                    this.users.push(nextUser);
                    this.itemsNeedReordering = true;
                    break;
                }
            }
        }

        return output;
    }

    private priority(itemToPrioritise: ItemData): number {
        // What is the relative position of this item, relative to the items queued by its user.
        const userQueuePosition = this.items
            .filter(item => item.userId === itemToPrioritise.userId)
            .indexOf(itemToPrioritise);

        return this.users.length * userQueuePosition + this.users.indexOf(itemToPrioritise.userId);
    }

    push(item: ItemData) {
        this.itemsNeedReordering = true;
        this.users.push(item.userId);
        this.items.push(item);
    }

    private removeUserIfTheyHaveNoItems(userId: string) {
        const result = this.items.find(item => item.userId === userId);

        // user has no items, if true
        if (result === undefined) {
            this.users.remove(userId);
        }
    }

    [Symbol.iterator]() {
        this.enforceOrder();
        return this.items[Symbol.iterator]();
    }
}
