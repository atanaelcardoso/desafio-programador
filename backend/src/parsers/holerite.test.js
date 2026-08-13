import assert from 'assert';
import { parseHolerite } from './holerite.js';

// Testes básicos do parser holerite
console.log('🧪 Testando Parser Holerite...\n');

// Teste 1: Competência e verbas básicas
const teste1Text = `
  Competência 01/2020
  
  0010 Salário Base 2.389,77
  5560 Horas Extras - 50% 155,91
  
  Base INSS 2.545,68
  Valor Líquido 2.282,81
`;

const result1 = parseHolerite([{ text: teste1Text, source: 'text' }]);
console.log('Teste 1 - Competência e verbas:');
console.log(JSON.stringify(result1, null, 2));
assert(result1.pages[0].month === '01', 'Deveria detectar mês 01');
assert(result1.pages[0].year === '2020', 'Deveria detectar ano 2020');
assert(result1.pages[0].fields.length >= 2, 'Deveria ter pelo menos 2 verbas');
assert(result1.pages[0].bases.length >= 2, 'Deveria ter pelo menos 2 bases');
console.log('✅ Passou\n');

// Teste 2: Separação entre fields e bases
console.log('Teste 2 - Separação fields vs bases:');
const fields = result1.pages[0].fields;
const bases = result1.pages[0].bases;
const baseLabels = bases.map(b => b.label);
console.log('Fields:', fields.map(f => f.label));
console.log('Bases:', baseLabels);

// Validar que "Base INSS" não está em fields
const hasBaseInFields = fields.some(f => f.label.includes('Base INSS'));
assert(!hasBaseInFields, 'Base INSS não deveria estar em fields');
console.log('✅ Passou\n');

console.log('✅ Todos os testes passaram!');
