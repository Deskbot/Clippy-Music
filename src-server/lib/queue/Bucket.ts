import * as arrayUtils from "../utils/arrayUtils";

import { ItemData } from "../../types/ItemData";
import { UniqueArray } from "../utils/UniqueArray";

export class Bucket implements Iterable<ItemData> {
    private items: ItemData[];
    private itemsNeedReordering = false;
    private users: UniqueArray<string>;

    constructor(initialItems?: ItemData[]) {
        if (initialItems) {
            this.items = initialItems;

            const users = new UniqueArray<string>();
            for (const item of initialItems) {
                users.push(item.userId);
            }
            this.users = users;

        } else {
            this.items = [];
            this.users = new UniqueArray<string>();
        }
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
        return arrayUtils.removeFirst(this.items, item => item.id === contentId);
    }

    private enforceOrder() {
        if (!this.itemsNeedReordering) {
            return;
        }

        this.items = [...this.items].sort((left, right) => {
            return this.priority(left) - this.priority(right);
        });

        this.itemsNeedReordering = false;
    }

    get length(): number {
        return this.items.length;
    }

    outputFrontItem(): ItemData | undefined {
        this.enforceOrder();
        const output = this.items.shift();

        if (output) {
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

    [Symbol.iterator]() {
        this.enforceOrder();
        return this.items[Symbol.iterator]();
    }
}
