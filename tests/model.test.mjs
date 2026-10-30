import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanAnswers,completion,validToken,escapeHtml} from '../src/model.js';
test('solo acepta campos de la guía y limita el tamaño de las respuestas',()=>{
 const clean=cleanAnswers({sampleAnswer:'a'.repeat(7000),ready1:true,ready2:'true',unknown:'x',source1:42});
 assert.equal(clean.sampleAnswer.length,6000);assert.equal(clean.ready1,true);
 assert.equal('unknown' in clean,false);assert.equal('ready2' in clean,false);assert.equal('source1' in clean,false);
 assert.deepEqual(cleanAnswers([]),{});
});
test('el progreso descarta espacios y no cuenta casillas como respuestas',()=>{
 assert.deepEqual(completion({a:'   ',b:'sí',ready1:true},['a','b']),{filled:1,total:2,percent:50});
});
test('los enlaces de sesión exigen 256 bits y las respuestas no inyectan HTML',()=>{
 assert.equal(validToken('a'.repeat(64)),true);assert.equal(validToken('a'.repeat(63)),false);assert.equal(validToken('<script>'),false);
 assert.equal(escapeHtml('<script>"&'), '&lt;script&gt;&quot;&amp;');
});
