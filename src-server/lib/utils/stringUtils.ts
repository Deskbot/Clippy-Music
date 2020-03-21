export function getFileNameFromUrl(url: string): string {
    let name = url.split("/").pop();
    if (name === undefined) {
        return "";
    } else {
        name = name.length <= 1 ? undefined : name.split(".").shift();
    }

    if (name === undefined) {
        return "";
    }

    return name;
}

export function toNumber(data: any): number | undefined {
    const maybeNaN = parseInt(data);
    if (Number.isNaN(maybeNaN)) {
        return undefined;
    }

    return maybeNaN;
}
