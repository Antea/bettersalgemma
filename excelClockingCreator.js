var moment = require('moment');
moment().locale('it');

/**
 * Crea il foglio excel da inserire nel workbook passato come parametro, contenente le informazioni del timbratore
 * passate come parametro.
 * 
 * @param {workbook} workbook 
 * @param {string} userName 
 * @param {json} clockingTask 
 * @param {moment} firstOfMoment 
 */
function createClockingTableExcel(sheet, usersClockingsTaskArray, firstOfMoment) {
	usersClockingsTaskArray.forEach(function (userClockingsTask, userIndex) {
		var user = userClockingsTask.user;
		var clockingTask = userClockingsTask.clockingTask;
		var monthLength = clockingTask.mese.length;
		if (!excelColumn) {
			var excelColumn = new Array(monthLength);
			excelColumn.fill({ header: "", width: 5 });
			excelColumn = [{ header: "", key: 'name', width: 20 }].concat(excelColumn).concat([{ header: "", key: "total", width: 7 }]);
		}
		var headersRow = [user.nome];
		var actualClockingRow = ["Ore effettive scalate"];
		var clockingRow = ["Ore Pagate"];
		var differenceRow = ["Differenza"];
		clockingTask.mese.forEach(function (day, index) {
			var dayOfMonth = moment.utc(firstOfMoment).add(index, 'days').date();
			headersRow.push(dayOfMonth);
			actualClockingRow.push(day.actualWorkedTime);
			clockingRow.push(day.calculatedWorkedTime);
			var difference = day.actualWorkedTime - day.calculatedWorkedTime;
			differenceRow.push(difference != 0 ? difference : "");
		});
		headersRow.push("Totali");
		actualClockingRow.push(clockingTask.totalActualTime);
		clockingRow.push(clockingTask.totalWorkedTime);
		var totalDifference = clockingTask.totalActualTime - clockingTask.totalWorkedTime;
		differenceRow.push(totalDifference != 0 ? totalDifference : "");
		sheet.columns = excelColumn;
		sheet.addRow(headersRow);
		var firstRowTable = sheet.lastRow;
		sheet.addRow(actualClockingRow).commit();
		sheet.addRow(clockingRow).commit();
		sheet.addRow(differenceRow).commit();
		var emptyRow = new Array(clockingRow.length - 1);
		emptyRow.fill("");
		sheet.addRow(["Ore ordinarie"].concat(emptyRow));
		addTotalFormulaAndCommitLastEditableRow(sheet, monthLength);
		sheet.addRow(["Ore viaggio"].concat(emptyRow));
		addTotalFormulaAndCommitLastEditableRow(sheet, monthLength);
		sheet.addRow(["Ore straordinarie"].concat(emptyRow));
		addTotalFormulaAndCommitLastEditableRow(sheet, monthLength);
		sheet.addRow(["Ore ferie"].concat(emptyRow));
		addTotalFormulaAndCommitLastEditableRow(sheet, monthLength);
		sheet.addRow(["Ore permessi"].concat(emptyRow));
		addTotalFormulaAndCommitLastEditableRow(sheet, monthLength);
		sheet.addRow(["Ore malattia"].concat(emptyRow));
		addTotalFormulaAndCommitLastEditableRow(sheet, monthLength);
		sheet.addRow(["Altro(Specificare nelle note)"].concat(emptyRow));
		addTotalFormulaAndCommitLastEditableRow(sheet, monthLength);
		sheet.addRow(["Giorno trasferta"].concat(emptyRow));
		var lastRowWithoutNote = sheet.lastRow;
		addTotalFormulaAndCommitLastEditableRow(sheet, monthLength);
		setStyleToTable(sheet, firstRowTable, lastRowWithoutNote, firstOfMoment);
		sheet.addRow(["Note"].concat(emptyRow));
		var noteRow = sheet.lastRow;
		noteRow.eachCell(function (cell, colNumber) {
			if (colNumber === 1) {
				cell.style = getRowHeaderStyle();
			} else {
				cell.style = getDefaultStyle();
			}
		});
		sheet.mergeCells(noteRow.getCell(2).address, noteRow.getCell(monthLength + 2).address);
		noteRow.commit();
		firstRowTable.getCell(1).style = getNameStyle();
		firstRowTable.commit();
		sheet.addRow([""].concat(emptyRow)).commit();
		sheet.addRow([""].concat(emptyRow)).commit();
	});
}

/**
 * Aggiunge la formula di somma sulla riga passata, dalla seconda cella a quella numero monthLength + 1.
 */
function addTotalFormulaAndCommitLastEditableRow(sheet, monthLength) {
	var editableRow = sheet.lastRow;
	var resultFormula = 'SUM(' + editableRow.getCell(2).address + ':' + editableRow.getCell(monthLength + 1).address + ')';
	editableRow.getCell(monthLength + 2).value = { formula: resultFormula };
	editableRow.commit();
}

/**
 * Crea lo stile di default delle celle dell'excel.
 * @returns {json} defaultStyle.
 */
function getDefaultStyle() {
	var defaultStyle = { border: { top: { style: 'medium' }, left: { style: 'medium' }, bottom: { style: 'medium' }, right: { style: 'medium' } } };
	defaultStyle.font = { name: 'Calibri', size: '10', bold: true };
	defaultStyle.alignment = { horizontal: 'center', wrapText: true };
	return defaultStyle;
}

/**
 * Crea e ritorna lo stile per le celle di intestazione delle righe.
 * @returns {json} rowHeaderStyle.
 */
function getRowHeaderStyle() {
	var rowHeaderStyle = { border: { top: { style: 'medium' }, left: { style: 'medium' }, bottom: { style: 'medium' }, right: { style: 'medium' } } };
	rowHeaderStyle.font = { name: 'Calibri', size: '8', bold: false };
	rowHeaderStyle.alignment = { horizontal: 'center', wrapText: true };
	return rowHeaderStyle;
}

/**
 * Crea e ritorna lo stile per la cella contenente il nome della risorsa cui l'excel fa riferimento.
 * @returns {json} nameStyle.
 */
function getNameStyle() {
	var nameStyle = { border: { top: { style: 'medium' }, left: { style: 'medium' }, bottom: { style: 'medium' }, right: { style: 'medium' } } };
	nameStyle.font = { name: 'Calibri', size: '8', bold: true };
	nameStyle.alignment = { horizontal: 'center', wrapText: true };
	nameStyle.fill = getYellowFillField();
	return nameStyle;
}

/**
 * Crea e ritorna il campo fill per un qualsiasi stile.
 * @return {json} fillField.
 */
function getYellowFillField() {
	return { type: "pattern", pattern: "solid", fgColor: { argb: 'FFFFFF00' } };
}

/**
 * Permette di settare lo stile dello sheet passato come parametro.
 * 
 * @param {sheet} sheet 
 * @param {moment} firstOfMoment 
 */
function setStyleToTable(sheet, firstRowTable, lastRowTable, firstOfMoment) {
	var rowHeaderStyle = getRowHeaderStyle();
	var cellStyle = getDefaultStyle();
	var yellowStyle = getDefaultStyle();
	yellowStyle.fill = getYellowFillField();
	for (var idx = firstRowTable.number; idx <= lastRowTable.number; idx++) {
		var row = sheet.getRow(idx);
		row.eachCell(function (cell, colNumber) {
			if (colNumber === 1) {
				cell.style = rowHeaderStyle;
			} else if (colNumber === row.cellCount) {
				cell.style = cellStyle;
			} else {
				var styleToUse = cellStyle;
				var momentDay = moment.utc(firstOfMoment).add(colNumber - 2, 'd');
				if (momentDay.day() === 0 || momentDay.day() === 6) {
					styleToUse = yellowStyle;
				}
				cell.style = styleToUse;
			}
		});
	}
}

exports.createClockingTableExcel = createClockingTableExcel;