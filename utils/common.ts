export function getRandomLetters(length : number) : string {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += letters.charAt(Math.floor(Math.random() * letters.length));
    }
    return result;
}

export function getRandomNumber(length : number) : string {
    const numbers = '0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += numbers.charAt(Math.floor(Math.random() * numbers.length));
    }
    return result;
}

/** Shared masters reused by state / city / project tests. Created only if missing. */
export const EXISTING_COUNTRY = 'Test country';
export const EXISTING_COUNTRY_CODE2 = 'ZZ';
export const EXISTING_COUNTRY_CODE3 = 'ZZZ';
export const EXISTING_STATE = 'Tamil Nadu';
export const EXISTING_CITY = 'Chennai';
