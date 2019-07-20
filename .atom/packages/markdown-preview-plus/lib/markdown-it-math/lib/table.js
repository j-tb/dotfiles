"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function getLine(state, line) {
    const pos = state.bMarks[line] + state.blkIndent;
    const max = state.eMarks[line];
    return state.src.substr(pos, max - pos);
}
function escapedSplit(str, openDelims, closeDelims) {
    const result = [];
    let pos = 0;
    const max = str.length;
    let ch;
    let escapes = 0;
    let lastPos = 0;
    let lastDelim = 0;
    let delimed = false;
    let delimMaskMap;
    let openDelimIdx = -1;
    let closeDelimIdx = -1;
    ch = str.charCodeAt(pos);
    delimMaskMap = function (e) {
        return str.substring(pos, pos + e.length) === e;
    };
    while (pos < max) {
        openDelimIdx = openDelims.map(delimMaskMap).indexOf(true);
        closeDelimIdx = closeDelims.map(delimMaskMap).indexOf(true);
        if (openDelimIdx > -1 && escapes % 2 === 0 && !delimed) {
            delimed = !delimed;
            lastDelim = pos + openDelims[openDelimIdx].length - 1;
            pos += openDelims[openDelimIdx].length - 1;
        }
        else if (closeDelimIdx > -1 && escapes % 2 === 0 && delimed) {
            delimed = !delimed;
            lastDelim = pos + closeDelims[closeDelimIdx].length - 1;
            pos += closeDelims[closeDelimIdx].length - 1;
        }
        else if (ch === 0x7c && escapes % 2 === 0 && !delimed) {
            result.push(str.substring(lastPos, pos));
            lastPos = pos + 1;
        }
        else if (ch === 0x5c) {
            escapes++;
        }
        else {
            escapes = 0;
        }
        pos++;
        if (pos === max && delimed) {
            delimed = false;
            pos = lastDelim + 1;
        }
        ch = str.charCodeAt(pos);
    }
    result.push(str.substring(lastPos));
    return result;
}
function table(openDelims, closeDelims, state, startLine, endLine, silent) {
    let ch;
    let lineText;
    let pos;
    let i;
    let nextLine;
    let columns;
    let columnCount;
    let token;
    let aligns;
    let t;
    let tableLines;
    let tbodyLines;
    if (startLine + 2 > endLine) {
        return false;
    }
    nextLine = startLine + 1;
    if (state.sCount[nextLine] < state.blkIndent) {
        return false;
    }
    pos = state.bMarks[nextLine] + state.tShift[nextLine];
    if (pos >= state.eMarks[nextLine]) {
        return false;
    }
    ch = state.src.charCodeAt(pos);
    if (ch !== 0x7c && ch !== 0x2d && ch !== 0x3a) {
        return false;
    }
    lineText = getLine(state, startLine + 1);
    if (!/^[-:| ]+$/.test(lineText)) {
        return false;
    }
    columns = lineText.split('|');
    aligns = [];
    for (i = 0; i < columns.length; i++) {
        t = columns[i].trim();
        if (!t) {
            if (i === 0 || i === columns.length - 1) {
                continue;
            }
            else {
                return false;
            }
        }
        if (!/^:?-+:?$/.test(t)) {
            return false;
        }
        if (t.charCodeAt(t.length - 1) === 0x3a) {
            aligns.push(t.charCodeAt(0) === 0x3a ? 'center' : 'right');
        }
        else if (t.charCodeAt(0) === 0x3a) {
            aligns.push('left');
        }
        else {
            aligns.push('');
        }
    }
    lineText = getLine(state, startLine).trim();
    if (lineText.indexOf('|') === -1) {
        return false;
    }
    columns = escapedSplit(lineText.replace(/^\||\|$/g, ''), openDelims, closeDelims);
    columnCount = columns.length;
    if (columnCount > aligns.length) {
        return false;
    }
    if (silent) {
        return true;
    }
    token = state.push('table_open', 'table', 1);
    token.map = tableLines = [startLine, 0];
    token = state.push('thead_open', 'thead', 1);
    token.map = [startLine, startLine + 1];
    token = state.push('tr_open', 'tr', 1);
    token.map = [startLine, startLine + 1];
    for (i = 0; i < columns.length; i++) {
        token = state.push('th_open', 'th', 1);
        token.map = [startLine, startLine + 1];
        if (aligns[i]) {
            token.attrs = [['style', 'text-align:' + aligns[i]]];
        }
        token = state.push('inline', '', 0);
        token.content = columns[i].trim();
        token.map = [startLine, startLine + 1];
        token.children = [];
        token = state.push('th_close', 'th', -1);
    }
    token = state.push('tr_close', 'tr', -1);
    token = state.push('thead_close', 'thead', -1);
    token = state.push('tbody_open', 'tbody', 1);
    token.map = tbodyLines = [startLine + 2, 0];
    for (nextLine = startLine + 2; nextLine < endLine; nextLine++) {
        if (state.sCount[nextLine] < state.blkIndent) {
            break;
        }
        lineText = getLine(state, nextLine).trim();
        if (lineText.indexOf('|') === -1) {
            break;
        }
        columns = escapedSplit(lineText.replace(/^\||\|$/g, ''), openDelims, closeDelims);
        token = state.push('tr_open', 'tr', 1);
        for (i = 0; i < columnCount; i++) {
            token = state.push('td_open', 'td', 1);
            if (aligns[i]) {
                token.attrs = [['style', 'text-align:' + aligns[i]]];
            }
            token = state.push('inline', '', 0);
            token.content = columns[i] ? columns[i].trim() : '';
            token.children = [];
            token = state.push('td_close', 'td', -1);
        }
        token = state.push('tr_close', 'tr', -1);
    }
    token = state.push('tbody_close', 'tbody', -1);
    token = state.push('table_close', 'table', -1);
    tableLines[1] = tbodyLines[1] = nextLine;
    state.line = nextLine;
    return true;
}
function makeTable(options) {
    const openDelims = options.inlineDelim.map((i) => i[0]);
    const closeDelims = options.inlineDelim.map((i) => i[1]);
    openDelims.unshift('`');
    closeDelims.unshift('`');
    return table.bind(null, openDelims, closeDelims);
}
exports.makeTable = makeTable;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGFibGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvbWFya2Rvd24taXQtbWF0aC9saWIvdGFibGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFJQSxTQUFTLE9BQU8sQ0FBQyxLQUFVLEVBQUUsSUFBWTtJQUN2QyxNQUFNLEdBQUcsR0FBRyxLQUFLLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLEtBQUssQ0FBQyxTQUFTLENBQUE7SUFDaEQsTUFBTSxHQUFHLEdBQUcsS0FBSyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQTtJQUU5QixPQUFPLEtBQUssQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsRUFBRSxHQUFHLEdBQUcsR0FBRyxDQUFDLENBQUE7QUFDekMsQ0FBQztBQWtCRCxTQUFTLFlBQVksQ0FDbkIsR0FBVyxFQUNYLFVBQW9CLEVBQ3BCLFdBQXFCO0lBRXJCLE1BQU0sTUFBTSxHQUFHLEVBQUUsQ0FBQTtJQUNqQixJQUFJLEdBQUcsR0FBRyxDQUFDLENBQUE7SUFDWCxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsTUFBTSxDQUFBO0lBQ3RCLElBQUksRUFBRSxDQUFBO0lBQ04sSUFBSSxPQUFPLEdBQUcsQ0FBQyxDQUFBO0lBQ2YsSUFBSSxPQUFPLEdBQUcsQ0FBQyxDQUFBO0lBQ2YsSUFBSSxTQUFTLEdBQUcsQ0FBQyxDQUFBO0lBQ2pCLElBQUksT0FBTyxHQUFHLEtBQUssQ0FBQTtJQUNuQixJQUFJLFlBQVksQ0FBQTtJQUNoQixJQUFJLFlBQVksR0FBRyxDQUFDLENBQUMsQ0FBQTtJQUNyQixJQUFJLGFBQWEsR0FBRyxDQUFDLENBQUMsQ0FBQTtJQUV0QixFQUFFLEdBQUcsR0FBRyxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQTtJQUd4QixZQUFZLEdBQUcsVUFBUyxDQUFTO1FBQy9CLE9BQU8sR0FBRyxDQUFDLFNBQVMsQ0FBQyxHQUFHLEVBQUUsR0FBRyxHQUFHLENB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QUFLLENBQUMsSUFBSSxDQUFDLFlBQVksRUFBRSxPQUFPLEVBQUUsQ0FBQyxDQUFDLENBQUE7SUFDNUMsS0FBSyxDQUFDLEdBQUcsR0FBRyxDQUFDLFNBQVMsRUFBRSxTQUFTLEdBQUcsQ0FBQyxDQUFDLENBQUE7SUFFdEMsS0FBSyxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQTtJQUN0QyxLQUFLLENBQUMsR0FBRyxHQUFHLENBQUMsU0FBUyxFQUFFLFNBQVMsR0FBRyxDQUFDLENBQUMsQ0FBQTtJQUV0QyxLQUFLLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLE9BQU8sQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUU7UUFDbkMsS0FBSyxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQTtRQUN0QyxLQUFLLENBQUMsR0FBRyxHQUFHLENBQUMsU0FBUyxFQUFFLFNBQVMsR0FBRyxDQUFDLENBQUMsQ0FBQTtRQUN0QyxJQUFJLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRTtZQUNiLEtBQUssQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDLE9BQU8sRUFBRSxhQUFhLEdBQUcsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQTtTQUNyRDtRQUVELEtBQUssR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUE7UUFDbkMsS0FBSyxDQUFDLE9BQU8sR0FBRyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUE7UUFDakMsS0FBSyxDQUFDLEdBQUcsR0FBRyxDQUFDLFNBQVMsRUFBRSxTQUFTLEdBQUcsQ0FBQyxDQUFDLENBQUE7UUFDdEMsS0FBSyxDQUFDLFFBQVEsR0FBRyxFQUFFLENBQUE7UUFFbkIsS0FBSyxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsVUFBVSxFQUFFLElBQUksRUFBRSxDQUFD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R0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQTtJQUN2RCxNQUFNLFdBQVcsR0FBRyxPQUFPLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUE7SUFFeEQsVUFBVSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQTtJQUN2QixXQUFXLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFBO0lBRXhCLE9BQU8sS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsVUFBVSxFQUFFLFdBQVcsQ0FBQyxDQUFBO0FBQ2xELENBQUM7QUFSRCw4QkFRQyIsInNvdXJjZXNDb250ZW50IjpbIi8vIG1hcmtkb3duLWl0LW1hdGhANDgwMjQzOTpsaWIvcnVsZXNfYmxvY2svdGFibGUuanNcbi8vIEdGTSB0YWJsZSwgbm9uLXN0YW5kYXJkXG4vLyB0c2xpbnQ6ZGlzYWJsZTpuby11bnNhZmUtYW55XG5cbmZ1bmN0aW9uIGdldExpbmUoc3RhdGU6IGFueSwgbGluZTogbnVtYmVyKSB7XG4gIGNvbnN0IHBvcyA9IHN0YXRlLmJNYXJrc1tsaW5lXSArIHN0YXRlLmJsa0luZGVudFxuICBjb25zdCBtYXggPSBzdGF0ZS5lTWFya3NbbGluZV1cblxuICByZXR1cm4gc3RhdGUuc3JjLnN1YnN0cihwb3MsIG1heCAtIHBvcylcbn1cblxuLyoqXG4gKiBQYXJzZSBhIHRhYmxlIHJvdyBmb3IgY29sdW1ucy9jZWxsc1xuICpcbiAqIEBwYXJhbSBzdHJpbmcgc3RyXG4gKiAgIFRoZSB0YWJsZSByb3cgdG8gcGFyc2UgZm9yIGNvbHVtbnMuXG4gKiBAcGFyYW0gIGFycmF5IG9mIHN0cmluZyBvcGVuRGVsaW1zXG4gKiAgIFRoZSBvcGVuaW5nIGRlbGltaXRlciBzZXF1ZW5jZXMgZm9yIGlubGluZXMgdGhhdCBwcmV2ZW50cyBhbnkgY29udGFpbmVkXG4gKiAgIHBpcGVzIGZyb20gZGVsaW1pdGluZyBjb2x1bW5zIG9mIHRoZSBwYXJlbnQgdGFibGUgYmxvY2suXG4gKiBAcGFyYW0gIGFycmF5IG9mIHN0cmluZyBjbG9zZURlbGltc1xuICogICBUaGUgY2xvc2luZyBkZWxpbWl0ZXIgc2VxdWVuY2UgZm9yIGFuIGlubGluZSB0aGF0IHByZXZlbnRzIGFueSBjb250YWluaW5nXG4gKiAgIHBpcGVzIGZyb20gZGVsaW1pdGluZyBjb2x1bW5zIG9mIHRoZSBwYXJlbnQgdGFibGUgYmxvY2suXG4gKiBAcmV0dXJuIGFycmF5IG9mIHN0cmluZ1xuICogICBUaGUgdW5wYXJzZWQgY29udGVudCBvZiB0aGUgY2VsbHMvY29sdW1ucyBpZGVudGlmaWVkIGluIHN0ciByZXR1cm5lZCBhc1xuICogICBpbmRpdmlkdWFsIGVsZW1lbnRzIG9mIGFuIGFycmF5LiBUaGUgY29udGVudCBpcyBzdGlsbCB0byBiZSBwYXJzZWQgYnkgdGhlXG4gKiAgIGlubGluZSBydWxlcy5cbiAqL1xuZnVuY3Rpb24gZXNjYXBlZFNwbGl0KFxuICBzdHI6IHN0cmluZyxcbiAgb3BlbkRlbGltczogc3RyaW5nW10sXG4gIGNsb3NlRGVsaW1zOiBzdHJpbmdbXSxcbikge1xuICBjb25zdCByZXN1bHQgPSBbXVxuICBsZXQgcG9zID0gMFxuICBjb25zdCBtYXggPSBzdHIubGVuZ3RoXG4gIGxldCBjaFxuICBsZXQgZXNjYXBlcyA9IDBcbiAgbGV0IGxhc3RQb3MgPSAwXG4gIGxldCBsYXN0RGVsaW0gPSAwXG4gIGxldCBkZWxpbWVkID0gZmFsc2VcbiAgbGV0IGRlbGltTWFza01hcFxuICBsZXQgb3BlbkRlbGltSWR4ID0gLTFcbiAgbGV0IGNsb3NlRGVsaW1JZHggPSAtMVxuXG4gIGNoID0gc3RyLmNoYXJDb2RlQXQocG9zKVxuXG4gIC8vIERlZiBtYXAgZm9yIG1hdGNoaW5nIG9wZW4vY2xvc2UgZGVsaW1pdGVyIHNlcXVlbmNlIHdpdGggc3RyQHBvc1xuICBkZWxpbU1hc2tNYXAgPSBmdW5jdGlvbihlOiBzdHJpbmcpIHtcbiAgICByZXR1cm4gc3RyLnN1YnN0cmluZyhwb3MsIHBvcyArIGUubGVuZ3RoKSA9PT0gZVxuICB9XG5cbiAgd2hpbGUgKHBvcyA8IG1heCkge1xuICAgIC8vIERldGVybWluZSBJRCBvZiBmaXJzdCBtYXRjaGluZyBvcGVuL2Nsb3NlIGRlbGltaXRlciBzZXF1ZW5jZVxuICAgIG9wZW5EZWxpbUlkeCA9IG9wZW5EZWxpbXMubWFwKGRlbGltTWFza01hcCkuaW5kZXhPZih0cnVlKVxuICAgIGNsb3NlRGVsaW1JZHggPSBjbG9zZURlbGltcy5tYXAoZGVsaW1NYXNrTWFwKS5pbmRleE9mKHRydWUpXG5cbiAgICAvLyBEb2VzIHN0ckBwb3MgbWF0Y2ggYW55IG9wZW5pbmcgZGVsaW1pdGVyP1xuICAgIGlmIChvcGVuRGVsaW1JZHggPiAtMSAmJiBlc2NhcGVzICUgMiA9PT0gMCAmJiAhZGVsaW1lZCkge1xuICAgICAgZGVsaW1lZCA9ICFkZWxpbWVkXG4gICAgICBsYXN0RGVsaW0gPSBwb3MgKyBvcGVuRGVsaW1zW29wZW5EZWxpbUlkeF0ubGVuZ3RoIC0gMVxuICAgICAgcG9zICs9IG9wZW5EZWxpbXNbb3BlbkRlbGltSWR4XS5sZW5ndGggLSAxXG4gICAgICAvLyBEb2VzIHN0ckBwb3MgbWF0Y2ggYW55IGNsb3NpbmcgZGVsaW1pdGVyP1xuICAgIH0gZWxzZSBpZiAoY2xvc2VEZWxpbUlkeCA+IC0xICYmIGVzY2FwZXMgJSAyID09PSAwICYmIGRlbGltZWQpIHtcbiAgICAgIGRlbGltZWQgPSAhZGVsaW1lZFxuICAgICAgbGFzdERlbGltID0gcG9zICsgY2xvc2VEZWxpbXNbY2xvc2VEZWxpbUlkeF0ubGVuZ3RoIC0gMVxuICAgICAgcG9zICs9IGNsb3NlRGVsaW1zW2Nsb3NlRGVsaW1JZHhdLmxlbmd0aCAtIDFcbiAgICB9IGVsc2UgaWYgKGNoID09PSAweDdjIC8qIHwgKi8gJiYgZXNjYXBlcyAlIDIgPT09IDAgJiYgIWRlbGltZWQpIHtcbiAgICAgIHJlc3VsdC5wdXNoKHN0ci5zdWJzdHJpbmcobGFzdFBvcywgcG9zKSlcbiAgICAgIGxhc3RQb3MgPSBwb3MgKyAxXG4gICAgfSBlbHNlIGlmIChjaCA9PT0gMHg1YyAvKiBcXCAqLykge1xuICAgICAgZXNjYXBlcysrXG4gICAgfSBlbHNlIHtcbiAgICAgIGVzY2FwZXMgPSAwXG4gICAgfVxuXG4gICAgcG9zKytcblxuICAgIC8vIElmIHRoZXJlIHdhcyBhbiB1bi1jbG9zZWQgZGVsaW1pdGVyIHNlcXVlbmNlLCBnbyBiYWNrIHRvIGp1c3QgYWZ0ZXJcbiAgICAvLyB0aGUgbGFzdCBkZWxpbWl0ZXIgc2VxdWVuY2UsIGJ1dCBhcyBpZiBpdCB3YXMgYSBub3JtYWwgY2hhcmFjdGVyXG4gICAgaWYgKHBvcyA9PT0gbWF4ICYmIGRlbGltZWQpIHtcbiAgICAgIGRlbGltZWQgPSBmYWxzZVxuICAgICAgcG9zID0gbGFzdERlbGltICsgMVxuICAgIH1cblxuICAgIGNoID0gc3RyLmNoYXJDb2RlQXQocG9zKVxuICB9XG5cbiAgcmVzdWx0LnB1c2goc3RyLnN1YnN0cmluZyhsYXN0UG9zKSlcblxuICByZXR1cm4gcmVzdWx0XG59XG5cbi8qKlxuICogQSB0YWJsZSBwbG9jayBwYXJzZXIgd2l0aCByZXN0cmljdGlvbnMgb24gcGlwZSBwbGFjZW1lbnRcbiAqXG4gKiBQYXJ0aWFsbHkgcG91bGF0ZWQgZG9jc3RyaW5nIGRlc2NyaWJpbmcgcGFyYW1ldGVycyBhZGRlZCB0b1xuICogYG1hcmtkb3duLWl0LW1hdGhANDgwMjQzOTpsaWIvcnVsZXNfYmxvY2svdGFibGUuanNgLlxuICpcbiAqIEBwYXJhbSAgYXJyYXkgb2Ygc3RyaW5nIG9wZW5EZWxpbXNcbiAqICAgVGhlIG9wZW5pbmcgZGVsaW1pdGVyIHNlcXVlbmNlcyBmb3IgaW5saW5lcyB0aGF0IHByZXZlbnRzIGFueSBjb250YWluZWRcbiAqICAgcGlwZXMgZnJvbSBkZWxpbWl0aW5nIGNvbHVtbnMgb2YgdGhlIHBhcmVudCB0YWJsZSBibG9jay5cbiAqIEBwYXJhbSAgYXJyYXkgb2Ygc3RyaW5nIGNsb3NlRGVsaW1zXG4gKiAgIFRoZSBjbG9zaW5nIGRlbGltaXRlciBzZXF1ZW5jZSBmb3IgYW4gaW5saW5lIHRoYXQgcHJldmVudHMgYW55IGNvbnRhaW5pbmdcbiAqICAgcGlwZXMgZnJvbSBkZWxpbWl0aW5nIGNvbHVtbnMgb2YgdGhlIHBhcmVudCB0YWJsZSBibG9jay5cbiAqL1xuZnVuY3Rpb24gdGFibGUoXG4gIG9wZW5EZWxpbXM6IHN0cmluZ1tdLFxuICBjbG9zZURlbGltczogc3RyaW5nW10sXG4gIHN0YXRlOiBhbnksXG4gIHN0YXJ0TGluZTogbnVtYmVyLFxuICBlbmRMaW5lOiBudW1iZXIsXG4gIHNpbGVudDogYm9vbGVhbixcbikge1xuICBsZXQgY2hcbiAgbGV0IGxpbmVUZXh0XG4gIGxldCBwb3NcbiAgbGV0IGlcbiAgbGV0IG5leHRMaW5lXG4gIGxldCBjb2x1bW5zXG4gIGxldCBjb2x1bW5Db3VudFxuICBsZXQgdG9rZW5cbiAgbGV0IGFsaWduc1xuICBsZXQgdFxuICBsZXQgdGFibGVMaW5lc1xuICBsZXQgdGJvZHlMaW5lc1xuXG4gIC8vIHNob3VsZCBoYXZlIGF0IGxlYXN0IHRocmVlIGxpbmVzXG4gIGlmIChzdGFydExpbmUgKyAyID4gZW5kTGluZSkge1xuICAgIHJldHVybiBmYWxzZVxuICB9XG5cbiAgbmV4dExpbmUgPSBzdGFydExpbmUgKyAxXG5cbiAgaWYgKHN0YXRlLnNDb3VudFtuZXh0TGluZV0gPCBzdGF0ZS5ibGtJbmRlbnQpIHtcbiAgICByZXR1cm4gZmFsc2VcbiAgfVxuXG4gIC8vIGZpcnN0IGNoYXJhY3RlciBvZiB0aGUgc2Vjb25kIGxpbmUgc2hvdWxkIGJlICd8JyBvciAnLSdcblxuICBwb3MgPSBzdGF0ZS5iTWFya3NbbmV4dExpbmVdICsgc3RhdGUudFNoaWZ0W25leHRMaW5lXVxuICBpZiAocG9zID49IHN0YXRlLmVNYXJrc1tuZXh0TGluZV0pIHtcbiAgICByZXR1cm4gZmFsc2VcbiAgfVxuXG4gIGNoID0gc3RhdGUuc3JjLmNoYXJDb2RlQXQocG9zKVxuICBpZiAoY2ggIT09IDB4N2MgLyogfCAqLyAmJiBjaCAhPT0gMHgyZCAvKiAtICovICYmIGNoICE9PSAweDNhIC8qIDogKi8pIHtcbiAgICByZXR1cm4gZmFsc2VcbiAgfVxuXG4gIGxpbmVUZXh0ID0gZ2V0TGluZShzdGF0ZSwgc3RhcnRMaW5lICsgMSlcbiAgaWYgKCEvXlstOnwgXSskLy50ZXN0KGxpbmVUZXh0KSkge1xuICAgIHJldHVybiBmYWxzZVxuICB9XG5cbiAgY29sdW1ucyA9IGxpbmVUZXh0LnNwbGl0KCd8JylcbiAgYWxpZ25zID0gW11cbiAgZm9yIChpID0gMDsgaSA8IGNvbHVtbnMubGVuZ3RoOyBpKyspIHtcbiAgICB0ID0gY29sdW1uc1tpXS50cmltKClcbiAgICBpZiAoIXQpIHtcbiAgICAgIC8vIGFsbG93IGVtcHR5IGNvbHVtbnMgYmVmb3JlIGFuZCBhZnRlciB0YWJsZSwgYnV0IG5vdCBpbiBiZXR3ZWVuIGNvbHVtbnM7XG4gICAgICAvLyBlLmcuIGFsbG93IGAgfC0tLXwgYCwgZGlzYWxsb3cgYCAtLS18fC0tLSBgXG4gICAgICBpZiAoaSA9PT0gMCB8fCBpID09PSBjb2x1bW5zLmxlbmd0aCAtIDEpIHtcbiAgICAgICAgY29udGludWVcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgfVxuICAgIH1cblxuICAgIGlmICghL146Py0rOj8kLy50ZXN0KHQpKSB7XG4gICAgICByZXR1cm4gZmFsc2VcbiAgICB9XG4gICAgaWYgKHQuY2hhckNvZGVBdCh0Lmxlbmd0aCAtIDEpID09PSAweDNhIC8qIDogKi8pIHtcbiAgICAgIGFsaWducy5wdXNoKHQuY2hhckNvZGVBdCgwKSA9PT0gMHgzYSAvKiA6ICovID8gJ2NlbnRlcicgOiAncmlnaHQnKVxuICAgIH0gZWxzZSBpZiAodC5jaGFyQ29kZUF0KDApID09PSAweDNhIC8qIDogKi8pIHtcbiAgICAgIGFsaWducy5wdXNoKCdsZWZ0JylcbiAgICB9IGVsc2Uge1xuICAgICAgYWxpZ25zLnB1c2goJycpXG4gICAgfVxuICB9XG5cbiAgbGluZVRleHQgPSBnZXRMaW5lKHN0YXRlLCBzdGFydExpbmUpLnRyaW0oKVxuICBpZiAobGluZVRleHQuaW5kZXhPZignfCcpID09PSAtMSkge1xuICAgIHJldHVybiBmYWxzZVxuICB9XG4gIGNvbHVtbnMgPSBlc2NhcGVkU3BsaXQoXG4gICAgbGluZVRleHQucmVwbGFjZSgvXlxcfHxcXHwkL2csICcnKSxcbiAgICBvcGVuRGVsaW1zLFxuICAgIGNsb3NlRGVsaW1zLFxuICApXG5cbiAgLy8gaGVhZGVyIHJvdyB3aWxsIGRlZmluZSBhbiBhbW91bnQgb2YgY29sdW1ucyBpbiB0aGUgZW50aXJlIHRhYmxlLFxuICAvLyBhbmQgYWxpZ24gcm93IHNob3VsZG4ndCBiZSBzbWFsbGVyIHRoYW4gdGhhdCAodGhlIHJlc3Qgb2YgdGhlIHJvd3MgY2FuKVxuICBjb2x1bW5Db3VudCA9IGNvbHVtbnMubGVuZ3RoXG4gIGlmIChjb2x1bW5Db3VudCA+IGFsaWducy5sZW5ndGgpIHtcbiAgICByZXR1cm4gZmFsc2VcbiAgfVxuXG4gIGlmIChzaWxlbnQpIHtcbiAgICByZXR1cm4gdHJ1ZVxuICB9XG5cbiAgdG9rZW4gPSBzdGF0ZS5wdXNoKCd0YWJsZV9vcGVuJywgJ3RhYmxlJywgMSlcbiAgdG9rZW4ubWFwID0gdGFibGVMaW5lcyA9IFtzdGFydExpbmUsIDBdXG5cbiAgdG9rZW4gPSBzdGF0ZS5wdXNoKCd0aGVhZF9vcGVuJywgJ3RoZWFkJywgMSlcbiAgdG9rZW4ubWFwID0gW3N0YXJ0TGluZSwgc3RhcnRMaW5lICsgMV1cblxuICB0b2tlbiA9IHN0YXRlLnB1c2goJ3RyX29wZW4nLCAndHInLCAxKVxuICB0b2tlbi5tYXAgPSBbc3RhcnRMaW5lLCBzdGFydExpbmUgKyAxXVxuXG4gIGZvciAoaSA9IDA7IGkgPCBjb2x1bW5zLmxlbmd0aDsgaSsrKSB7XG4gICAgdG9rZW4gPSBzdGF0ZS5wdXNoKCd0aF9vcGVuJywgJ3RoJywgMSlcbiAgICB0b2tlbi5tYXAgPSBbc3RhcnRMaW5lLCBzdGFydExpbmUgKyAxXVxuICAgIGlmIChhbGlnbnNbaV0pIHtcbiAgICAgIHRva2VuLmF0dHJzID0gW1snc3R5bGUnLCAndGV4dC1hbGlnbjonICsgYWxpZ25zW2ldXV1cbiAgICB9XG5cbiAgICB0b2tlbiA9IHN0YXRlLnB1c2goJ2lubGluZScsICcnLCAwKVxuICAgIHRva2VuLmNvbnRlbnQgPSBjb2x1bW5zW2ldLnRyaW0oKVxuICAgIHRva2VuLm1hcCA9IFtzdGFydExpbmUsIHN0YXJ0TGluZSArIDFdXG4gICAgdG9rZW4uY2hpbGRyZW4gPSBbXVxuXG4gICAgdG9rZW4gPSBzdGF0ZS5wdXNoKCd0aF9jbG9zZScsICd0aCcsIC0xKVxuICB9XG5cbiAgdG9rZW4gPSBzdGF0ZS5wdXNoKCd0cl9jbG9zZScsICd0cicsIC0xKVxuICB0b2tlbiA9IHN0YXRlLnB1c2goJ3RoZWFkX2Nsb3NlJywgJ3RoZWFkJywgLTEpXG5cbiAgdG9rZW4gPSBzdGF0ZS5wdXNoKCd0Ym9keV9vcGVuJywgJ3Rib2R5JywgMSlcbiAgdG9rZW4ubWFwID0gdGJvZHlMaW5lcyA9IFtzdGFydExpbmUgKyAyLCAwXVxuXG4gIGZvciAobmV4dExpbmUgPSBzdGFydExpbmUgKyAyOyBuZXh0TGluZSA8IGVuZExpbmU7IG5leHRMaW5lKyspIHtcbiAgICBpZiAoc3RhdGUuc0NvdW50W25leHRMaW5lXSA8IHN0YXRlLmJsa0luZGVudCkge1xuICAgICAgYnJlYWtcbiAgICB9XG5cbiAgICBsaW5lVGV4dCA9IGdldExpbmUoc3RhdGUsIG5leHRMaW5lKS50cmltKClcbiAgICBpZiAobGluZVRleHQuaW5kZXhPZignfCcpID09PSAtMSkge1xuICAgICAgYnJlYWtcbiAgICB9XG4gICAgY29sdW1ucyA9IGVzY2FwZWRTcGxpdChcbiAgICAgIGxpbmVUZXh0LnJlcGxhY2UoL15cXHx8XFx8JC9nLCAnJyksXG4gICAgICBvcGVuRGVsaW1zLFxuICAgICAgY2xvc2VEZWxpbXMsXG4gICAgKVxuXG4gICAgdG9rZW4gPSBzdGF0ZS5wdXNoKCd0cl9vcGVuJywgJ3RyJywgMSlcbiAgICBmb3IgKGkgPSAwOyBpIDwgY29sdW1uQ291bnQ7IGkrKykge1xuICAgICAgdG9rZW4gPSBzdGF0ZS5wdXNoKCd0ZF9vcGVuJywgJ3RkJywgMSlcbiAgICAgIGlmIChhbGlnbnNbaV0pIHtcbiAgICAgICAgdG9rZW4uYXR0cnMgPSBbWydzdHlsZScsICd0ZXh0LWFsaWduOicgKyBhbGlnbnNbaV1dXVxuICAgICAgfVxuXG4gICAgICB0b2tlbiA9IHN0YXRlLnB1c2goJ2lubGluZScsICcnLCAwKVxuICAgICAgdG9rZW4uY29udGVudCA9IGNvbHVtbnNbaV0gPyBjb2x1bW5zW2ldLnRyaW0oKSA6ICcnXG4gICAgICB0b2tlbi5jaGlsZHJlbiA9IFtdXG5cbiAgICAgIHRva2VuID0gc3RhdGUucHVzaCgndGRfY2xvc2UnLCAndGQnLCAtMSlcbiAgICB9XG4gICAgdG9rZW4gPSBzdGF0ZS5wdXNoKCd0cl9jbG9zZScsICd0cicsIC0xKVxuICB9XG4gIHRva2VuID0gc3RhdGUucHVzaCgndGJvZHlfY2xvc2UnLCAndGJvZHknLCAtMSlcbiAgdG9rZW4gPSBzdGF0ZS5wdXNoKCd0YWJsZV9jbG9zZScsICd0YWJsZScsIC0xKVxuXG4gIHRhYmxlTGluZXNbMV0gPSB0Ym9keUxpbmVzWzFdID0gbmV4dExpbmVcbiAgc3RhdGUubGluZSA9IG5leHRMaW5lXG4gIHJldHVybiB0cnVlXG59XG5cbi8qKlxuICogUHJlcGFyZSBhIHRhYmxlIHBsb2NrIHBhcnNlciB3aXRoIHJlc3RyaWN0aW9ucyBvbiBwaXBlIHBsYWNlbWVudFxuICpcbiAqIEBwYXJhbSAgc3RyaW5nIG9wZW5cbiAqICAgVGhlIG9wZW5pbmcgZGVsaW1pdGVyIHNlcXVlbmNlIGZvciBhbiBpbmxpbmUgdGhhdCBwcmV2ZW50cyBhbnkgY29udGFpbmVkXG4gKiAgIHBpcGVzIGZyb20gZGVsaW1pdGluZyBjb2x1bW5zIG9mIHRoZSBwYXJlbnQgdGFibGUgYmxvY2suXG4gKiBAcGFyYW0gIHN0cmluZyBjbG9zZVxuICogICBUaGUgY2xvc2luZyBkZWxpbWl0ZXIgc2VxdWVuY2UgZm9yIGFuIGlubGluZSB0aGF0IHByZXZlbnRzIGFueSBjb250YWluaW5nXG4gKiAgIHBpcGVzIGZyb20gZGVsaW1pdGluZyBjb2x1bW5zIG9mIHRoZSBwYXJlbnQgdGFibGUgYmxvY2suXG4gKiBAcmV0dXJuIGZ1bmN0aW9uXG4gKiAgIFRoZSB0YWJsZSBibG9jayBwYXJzZXIgdGhhdCBzaG91bGQgYmUgdXNlZCBpbiBwbGFjZSBvZiB0aGUgZXhpc3RpbmcgdGFibGVcbiAqICAgYmxvY2sgcGFyc2VyIHN1Y2ggdGhhdCB0aGUgc3BlY2lmaWVkIGlubGluZSBieSBgb3BlbmAgYW5kIGBjbG9zZWAgaXNcbiAqICAgcmVzcGVjdGVkLiBUaGUgZGVsaW1pdGVycyBhcmUgYWRkZWQgdG8gZXhpc3RpbmcgbGlzdCBvZiBkZWxpbWl0ZXIgcGFpcnMgaW5cbiAqICAgYGVzY2FwZWRTcGxpdERlbGltaXRlcnNgIGFsbG93aW5nIGBtYXJrZG93bi1pdC1tYXRoYCB0byBiZSBgdXNlYCdkIG11bHRpcGxlXG4gKiAgIHRpbWVzIGxlYWRpbmcgdG8gbXVsdGlwbGUgaW5saW5lIGRlbGltaXRlcnMuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBtYWtlVGFibGUob3B0aW9uczogT3B0aW9ucykge1xuICBjb25zdCBvcGVuRGVsaW1zID0gb3B0aW9ucy5pbmxpbmVEZWxpbS5tYXAoKGkpID0+IGlbMF0pXG4gIGNvbnN0IGNsb3NlRGVsaW1zID0gb3B0aW9ucy5pbmxpbmVEZWxpbS5tYXAoKGkpID0+IGlbMV0pXG5cbiAgb3BlbkRlbGltcy51bnNoaWZ0KCdgJylcbiAgY2xvc2VEZWxpbXMudW5zaGlmdCgnYCcpXG5cbiAgcmV0dXJuIHRhYmxlLmJpbmQobnVsbCwgb3BlbkRlbGltcywgY2xvc2VEZWxpbXMpXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgT3B0aW9ucyB7XG4gIGlubGluZURlbGltOiBbW3N0cmluZywgc3RyaW5nXV1cbiAgYmxvY2tEZWxpbTogW1tzdHJpbmcsIHN0cmluZ11dXG59XG4iXX0=