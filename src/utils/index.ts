
export default new class Utils {
  removeDuplicatesObjects(arr: any[]) {
    const uniqueObjects = new Map();
    arr.forEach((obj) => {
      const key = JSON.stringify(obj);
      uniqueObjects.set(key, obj);
    });
    return Array.from(uniqueObjects.values());
  }
}