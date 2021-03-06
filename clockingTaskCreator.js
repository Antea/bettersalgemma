var moment = require('moment');
moment().locale('it');

const TOTAL_ROUND_MINUTES = 15;
const MAX_TOLERANCE_IN_MINUTES = 1;
const MIN_LUNCH_MINUTES = 30;
const MIN_START_TIME = { hour: 8, minute: 0 };
const MAX_START_TIME = { hour: 9, minute: 0 };
const MAX_END_TIME = { hour: 18, minute: 0 };
const MIN_END_TIME = { hour: 17, minute: 0 };
const MIN_START_LUNCH = { hour: 12, minute: 0 };
const MAX_END_LUNCH = { hour: 14, minute: 0 };

/**
 * Passati la data di timbratura in ingresso, inizio pausa pranzo, fine pausa pranzo e uscita viene calcolato il totale delle ore lavorate
 * secondo la documentazione riportata in Interfaccia Timbratore.docx per i dipendenti full time e a orario ridotto con pausa pranzo annessa.
 * Nel caso manchi uno dei parametri di timbratura, viene ritornato -1 per indicare errore.
 * 
 * @param {moment} startClockingMoment 
 * @param {moment} startLunchMoment 
 * @param {moment} endLunchMoment 
 * @param {moment} endClockingMoment 
 * @param {Number} fullTimeHours
 * @return {moment} workedTime
 */
function calculateClockingsForFullTimeEmployee(fullTimeHours, momentArray) {
	var workedPayedTime = moment.duration(-1, 'h');
	if (momentArray.length == 4 || momentArray.length == 2) {
		var firstClockingMoment = moment.utc(momentArray[0]).second(0);
		var lastClockingMoment = momentArray.length == 4 ? moment.utc(momentArray[3]).second(0) : moment.utc(momentArray[1]).second(0);
		var minStartMoment = moment.utc(firstClockingMoment).set(MIN_START_TIME);
		var maxStartMoment = moment.utc(firstClockingMoment).set(MAX_START_TIME);
		var maxEndMoment = moment.utc(maxStartMoment).add(fullTimeHours + 1, 'h');
		var minEndMoment = moment.utc(minStartMoment).add(fullTimeHours + 1, 'h');
		var startDelay = 0;
		var endAdvance = 0;
		if (firstClockingMoment.isBefore(minStartMoment, 'minute')) {
			firstClockingMoment = moment(minStartMoment);
		} else if (firstClockingMoment.isAfter(maxStartMoment, 'minute')) {
			var maxRoundedStartMoment = moment(maxStartMoment);
			while (firstClockingMoment.isAfter(moment(maxRoundedStartMoment).add(MAX_TOLERANCE_IN_MINUTES, 'm'), 'minute')) {
				maxRoundedStartMoment = moment(maxRoundedStartMoment).add(TOTAL_ROUND_MINUTES, 'm');
			}
			firstClockingMoment = moment(maxRoundedStartMoment);
			startDelay = moment(firstClockingMoment).diff(maxStartMoment, 'minutes');
		};
		if (lastClockingMoment.isAfter(maxEndMoment, 'minute')) {
			lastClockingMoment = moment(maxEndMoment);
		} else if (lastClockingMoment.isBefore(minEndMoment, 'minute')) {
			var minRoundedEndMoment = moment(minEndMoment);
			while (lastClockingMoment.isBefore(moment(minRoundedEndMoment).subtract(MAX_TOLERANCE_IN_MINUTES, 'm'), 'minute')) {
				minRoundedEndMoment = moment(minRoundedEndMoment).subtract(TOTAL_ROUND_MINUTES, 'm');
			}
			lastClockingMoment = moment(minRoundedEndMoment);
			endAdvance = moment(minEndMoment).diff(lastClockingMoment, 'minutes');
		};
		var totalTimeInOffice = moment(lastClockingMoment).diff(moment(firstClockingMoment), 'minutes');
		var lunchErrors = { advance: 0, delay: 0 };
		var totalWorkedTime = momentArray.length == 4 ? totalTimeInOffice - calculateLunchbreak(momentArray[1], momentArray[2], lunchErrors) : totalTimeInOffice;

		var totalWorkedPayedTime = totalWorkedTime - (totalWorkedTime % TOTAL_ROUND_MINUTES);
		if (totalWorkedPayedTime >= moment.duration(fullTimeHours, 'h').asMinutes()) {
			workedPayedTime = moment.duration(fullTimeHours, 'h').asMinutes();
			workedPayedTime = moment.duration((workedPayedTime - startDelay - endAdvance - lunchErrors.advance - lunchErrors.delay), 'm');
		} else {
			workedPayedTime = moment.duration(totalWorkedPayedTime, 'm');
		}
	}
	return workedPayedTime;
};

/**
 * Calcola la lunghezza della pausa pranzo: L'inizio e la fine di questa sono arrotondati al TOTAL_ROUND_MINUTES inferiore e/o superiore nel caso in cui
 * questi siano precedenti e/o superiori a MIN_START_LUNCH e MAX_END_LUNCH impostando una tolleranza di MAX_TOLERANCE_IN_MINUTES.
 * Inoltre viene impostata una durata minima di MIN_LUNCH_MINUTES.
 * 
 * @param {moment} startLunch 
 * @param {moment} endLunch 
 * @return {Number} lunchPeriod
 */
function calculateLunchbreak(startLunch, endLunch, lunchErrors) {
	var minStartLunch = moment.utc(startLunch).set(MIN_START_LUNCH);
	var maxEndLunch = moment.utc(startLunch).set(MAX_END_LUNCH);
	startLunch = moment.utc(startLunch).second(0);
	endLunch = moment.utc(endLunch).second(0);
	if (startLunch.isBefore(minStartLunch, 'minute')) {
		var minRoundedStartLunch = moment(minStartLunch);
		while (startLunch.isBefore(moment(minRoundedStartLunch).subtract(MAX_TOLERANCE_IN_MINUTES, 'm'), 'minute')) {
			minRoundedStartLunch = moment(minRoundedStartLunch).subtract(TOTAL_ROUND_MINUTES, 'm');
		}
		startLunch = moment(minRoundedStartLunch);
		lunchErrors.advance = moment(minStartLunch).diff(startLunch, 'minutes');
	};
	if (endLunch.isAfter(maxEndLunch, 'minute')) {
		var maxRoundedEndLunch = moment(maxEndLunch);
		while (endLunch.isAfter(moment(maxRoundedEndLunch).add(MAX_TOLERANCE_IN_MINUTES, 'm'), 'minute')) {
			maxRoundedEndLunch = moment(maxRoundedEndLunch).add(TOTAL_ROUND_MINUTES, 'm');
		}
		endLunch = moment(maxRoundedEndLunch);
		lunchErrors.delay = moment(endLunch).diff(maxEndLunch, 'minutes');
	};
	var lunchPeriod = moment(endLunch).diff(moment(startLunch), 'minutes');
	if (lunchPeriod < MIN_LUNCH_MINUTES) {
		lunchPeriod = MIN_LUNCH_MINUTES;
	}
	return lunchPeriod;
};

/**
 * Date la timbratura iniziale, quella finale verrà calcolato il tempo di lavoro effettuato, effettuando un arrotondamento
 * al TOTAL_ROUND_MINUTES con una tolleranza di MAX_TOLERANCE_IN_MINUTES, come indicato nel documento Interfaccia Timbratore.docx.
 * In caso di mancati dati di ingresso verrà ritornato il valore -1 per indicare un errore.
 * 
 * @param {moment} startClockingMoment 
 * @param {moment} endClockingMoment 
 * @return {moment} workedTime
 */
function calculateClockingsForPartTimeEmployee(momentArray) {
	var workedTime = moment.duration(-1, 'h');
	if (momentArray.length == 4) {
		workedTime = calculateClockingsForFullTimeEmployee(8, momentArray);
	} else if (momentArray.length == 2) {
		var firstClockingMoment = moment.utc(momentArray[0]);
		var lastClockingMoment = moment.utc(momentArray[1]);
		firstClockingMoment = moment.utc(firstClockingMoment).second(0);
		lastClockingMoment = moment.utc(lastClockingMoment).second(0);
		if (moment(firstClockingMoment).isBefore(moment(firstClockingMoment).set(MIN_START_LUNCH))) {
			var minStartMoment = moment.utc(firstClockingMoment).set(MIN_START_TIME);
			var maxStartMoment = moment.utc(firstClockingMoment).set(MAX_START_TIME);
			if (firstClockingMoment.isBefore(minStartMoment, 'minute')) {
				firstClockingMoment = moment(minStartMoment);
			} else if (firstClockingMoment.isAfter(maxStartMoment, 'minute')) {
				var maxRoundedStartMoment = moment(maxStartMoment);
				while (firstClockingMoment.isAfter(moment(maxRoundedStartMoment).add(MAX_TOLERANCE_IN_MINUTES, 'm'), 'minute')) {
					maxRoundedStartMoment = moment(maxRoundedStartMoment).add(TOTAL_ROUND_MINUTES, 'm');
				}
				firstClockingMoment = moment(maxRoundedStartMoment);
			}
			var minEndMoment = moment(lastClockingMoment).set(MIN_START_LUNCH);
			if (lastClockingMoment.isBefore(minEndMoment, 'minute')) {
				var minRoundedLastMoment = moment(minEndMoment);
				while (lastClockingMoment.isBefore(moment(minRoundedLastMoment).subtract(MAX_TOLERANCE_IN_MINUTES, 'm'), 'minute')) {
					minRoundedLastMoment = moment(minRoundedLastMoment).subtract(TOTAL_ROUND_MINUTES, 'm');
				}
				lastClockingMoment = moment(minRoundedLastMoment);
			};
		} else {
			var maxStartMoment = moment.utc(firstClockingMoment).set(MAX_END_LUNCH);
			if (firstClockingMoment.isAfter(maxStartMoment, 'minute')) {
				var maxRoundedStartMoment = moment(maxStartMoment);
				while (firstClockingMoment.isAfter(moment(maxRoundedStartMoment).add(MAX_TOLERANCE_IN_MINUTES, 'm'), 'minute')) {
					maxRoundedStartMoment = moment(maxRoundedStartMoment).add(TOTAL_ROUND_MINUTES, 'm');
				}
				firstClockingMoment = moment(maxRoundedStartMoment);
			};
			var minEndMoment = moment(firstClockingMoment).set(MIN_END_TIME);
			var maxEndMoment = moment(firstClockingMoment).set(MAX_END_TIME);
			if (lastClockingMoment.isAfter(maxEndMoment, 'minute')) {
				lastClockingMoment = moment(maxEndMoment);
			} else if (lastClockingMoment.isBefore(minEndMoment, 'minute')) {
				var minRoundedEndMoment = moment(minEndMoment);
				while (lastClockingMoment.isBefore(moment(minRoundedEndMoment).subtract(MAX_TOLERANCE_IN_MINUTES, 'm'), 'minute')) {
					minRoundedEndMoment = moment(minRoundedEndMoment).subtract(TOTAL_ROUND_MINUTES, 'm');
				}
				lastClockingMoment = moment(minRoundedEndMoment);
			};
		}
		var totalWorkedTime = moment(lastClockingMoment).diff(moment(firstClockingMoment), 'minutes');
		workedTime = moment.duration(totalWorkedTime - (totalWorkedTime % TOTAL_ROUND_MINUTES), 'm');
	}
	return workedTime;
};

/**
 * Calcola il tempo di lavoro effettivamente timbrato troncato al quarto d'ora inferiore(Per gli eventuali straordinari).
 * @param {moment} startClockingMoment 
 * @param {moment} startLunchMoment 
 * @param {moment} endLunchMoment 
 * @param {moment} endClockingMoment 
 */
function calculateActualClockedTime(momentArray) {
	var actualClockedTime = moment.duration(-1, 'h');
	if (momentArray.length == 4) {
		firstClockingMoment = moment.utc(momentArray[0]).second(0);
		secondClockingMoment = moment.utc(momentArray[1]).second(0);
		thirdClockingMoment = moment.utc(momentArray[2]).second(0);
		lastClockingMoment = moment.utc(momentArray[3]).second(0);
		actualClockedTime = moment(secondClockingMoment).diff(moment(firstClockingMoment), 'minutes')
			+ moment(lastClockingMoment).diff(moment(thirdClockingMoment), 'minutes');
		actualClockedTime = moment.duration(actualClockedTime - (actualClockedTime % TOTAL_ROUND_MINUTES), 'm');
	} else if (momentArray.length == 2) {
		firstClockingMoment = moment(momentArray[0]).second(0);
		secondClockingMoment = moment(momentArray[1]).second(0);
		actualClockedTime = moment(secondClockingMoment).diff(moment(firstClockingMoment), 'minutes');
		actualClockedTime = moment.duration(actualClockedTime - (actualClockedTime % TOTAL_ROUND_MINUTES), 'm');
	}
	return actualClockedTime;
}

function calculateClockingsForPivaEmployee(momentArray) {
	var actualClockedTime = moment.duration(-1, 'h');
	if (momentArray.length % 2 == 0) {
		actualClockedTime = 0;
		for (i = momentArray.length - 1; i > 0; i -= 2) {
			secondClockingMoment = moment.utc(momentArray[i]).second(0);
			firstClockingMoment = moment.utc(momentArray[i - 1]).second(0);
			var tempActualClockedTime = moment(secondClockingMoment).diff(moment(firstClockingMoment), 'minutes');
			actualClockedTime += tempActualClockedTime;
		}
		actualClockedTime = moment.duration(actualClockedTime - (actualClockedTime % TOTAL_ROUND_MINUTES), 'm');
	}
	return actualClockedTime;
}

function createClockings(clockingsFromDB, firstOfMoment, lastOfMoment, user) {
	var monthLength = (moment.utc(lastOfMoment).diff(moment.utc(firstOfMoment), 'days')) + 1;
	var clockingTask = {};
	clockingTask = { mese: new Array(monthLength), totalWorkedTime: 0, totalActualTime: 0 };
	for (var d = 0; d < monthLength; d++) {
		clockingTask.mese[d] = { clockings: [], calculatedWorkedTime: 0, actualWorkedTime: 0, areClockingsValid: true, warning: false };
	}
	if (clockingsFromDB.length != 0) {
		clockingsFromDB.forEach(function (singleDayWithClocking, index, array) {
			var dayPosition = (moment(singleDayWithClocking.day)).diff(moment(firstOfMoment), 'days');
			clockingTask.mese[dayPosition].clockings = singleDayWithClocking.clockings;
			if (!user.orecontrattuali) {
				clockingTask.mese[dayPosition].calculatedWorkedTime = calculateClockingsForPivaEmployee(singleDayWithClocking.clockings).asHours();
				clockingTask.mese[dayPosition].actualWorkedTime = calculateClockingsForPivaEmployee(singleDayWithClocking.clockings).asHours();
				clockingTask.mese[dayPosition].areClockingsValid = clockingTask.mese[dayPosition].calculatedWorkedTime != -1 ? true : false;
				clockingTask.mese[dayPosition].warning = singleDayWithClocking.clockings.length == 2 ? true : false;
			} else if (user.orecontrattuali <= 5) {
				clockingTask.mese[dayPosition].calculatedWorkedTime = calculateClockingsForPartTimeEmployee(singleDayWithClocking.clockings).asHours();
				clockingTask.mese[dayPosition].actualWorkedTime = calculateActualClockedTime(singleDayWithClocking.clockings).asHours();
				clockingTask.mese[dayPosition].areClockingsValid = clockingTask.mese[dayPosition].calculatedWorkedTime != -1 ? true : false;
				clockingTask.mese[dayPosition].warning = singleDayWithClocking.clockings.length == 4 ? true : false;
			} else {
				clockingTask.mese[dayPosition].calculatedWorkedTime = calculateClockingsForFullTimeEmployee(user.orecontrattuali, singleDayWithClocking.clockings).asHours();
				clockingTask.mese[dayPosition].actualWorkedTime = calculateActualClockedTime(singleDayWithClocking.clockings).asHours();
				clockingTask.mese[dayPosition].areClockingsValid = clockingTask.mese[dayPosition].calculatedWorkedTime != -1 ? true : false;
				clockingTask.mese[dayPosition].warning = singleDayWithClocking.clockings.length == 2 ? true : false;
			}
			if (clockingTask.mese[dayPosition].calculatedWorkedTime != -1 && clockingTask.mese[dayPosition].actualWorkedTime != -1) {
				clockingTask.totalWorkedTime += clockingTask.mese[dayPosition].calculatedWorkedTime;
				clockingTask.totalActualTime += clockingTask.mese[dayPosition].actualWorkedTime;
			}
		});
	}
	return clockingTask;
}

exports.createClockings = createClockings;