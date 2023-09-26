const sameValue = (x: any, y: any) =>
    x === y ||
    (typeof x === 'number' && typeof y === 'number' && isNaN(x) && isNaN(y));

const includes = <T>(array: T[], searchElement: T) => {
    const len = array.length;
    let i = 0;
    while (i < len) {
        if (sameValue(array[i], searchElement)) {
            return true;
        }
        i++;
    }

    return false;
};

export default includes;
