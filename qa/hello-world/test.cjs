'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const vm = require('node:vm');

const code = fs.readFileSync(__dirname + '/Code.gs');
const expectedSha = 'fe3742293e2b296b24d512bb29568f0ea09ed2c820ea61b35240c75ff1e264f9';
const text = code.toString('utf8');

test('exact Active Drive source SHA-256 is unchanged', () => {
  assert.equal(crypto.createHash('sha256').update(code).digest('hex'), expectedSha);
});
test('safe HTML webapp entry point renders Hello World', () => {
  let callCount = 0;
  const mock = {createHtmlOutput: html => {
    callCount++;
    return { html, setTitle(title) { this.title=title; return this; } };
  }};
  const context = vm.createContext({HtmlService: mock});
  new vm.Script(text, {filename:'Code.gs'}).runInContext(context, {timeout:2000});
  assert.equal(typeof context.doGet, 'function');
  const response = context.doGet();
  assert.equal(callCount, 1);
  assert.match(response.html, /<h1>Hello World!<\/h1>/);
  assert.match(response.html, /^<!doctype html>/i);
  assert.match(response.html, /<\/html>$/i);
  assert.equal(response.title, 'T3TT Hello World Demo');
});
test('fixture contains no school data-service calls or credentials', () => {
  assert.doesNotMatch(text, /SpreadsheetApp|DriveApp|DocumentApp|GmailApp|PropertiesService|UrlFetchApp|ScriptApp|oauth|api[_-]?key|token/);
});
test('local QA is not public deployment evidence', () => {
  assert.match(text, /function doGet\(\)/);
  assert.ok(!fs.existsSync(__dirname + '/PUBLIC_DEPLOY_VERIFIED.json'));
});
