import { State } from 'country-state-city';
import { getAllStates } from 'india-states-districts';

const cscStates = State.getStatesOfCountry('IN').map(s => s.name);
const isdStates = getAllStates();

const missingInIsd = cscStates.filter(s => !isdStates.includes(s));
console.log('States in CSC but not ISD:', missingInIsd);

const missingInCsc = isdStates.filter(s => !cscStates.includes(s));
console.log('States in ISD but not CSC:', missingInCsc);
