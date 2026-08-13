import assert from 'assert';
import { parseCartaoPonto } from './cartaoPonto.js';

// Testes básicos do parser cartão de ponto
console.log('🧪 Testando Parser Cartão de Ponto...\n');

// Teste 1: Data e batidas válidas
const teste1Text = `
  21/05/2019 08:25 18:25
  22/05/2019 09:00 17:30
`;

const result1 = parseCartaoPonto([{ text: teste1Text, source: 'text' }]);
console.log('Teste 1 - Data e batidas válidas:');
console.log(JSON.stringify(result1, null, 2));
assert(result1.pages[0].days.length >= 2, 'Deveria encontrar pelo menos 2 dias');
assert(result1.pages[0].days[0].punches.length === 2, 'Primeiro dia deveria ter 2 batidas');
console.log('✅ Passou\n');

// Teste 2: Data com batidas ímpares (falta saída)
const teste2Text = `
  25/05/2019 08:00
`;

const result2 = parseCartaoPonto([{ text: teste2Text, source: 'text' }]);
console.log('Teste 2 - Batidas ímpares:');
console.log(JSON.stringify(result2, null, 2));
assert(result2.pages[0].days[0].punches.length === 1, 'Deveria ter 1 batida (ímpar)');
console.log('✅ Passou\n');

// Teste 3: Data inválida
const teste3Text = `
  32/13/2019 08:00 17:00
`;

const result3 = parseCartaoPonto([{ text: teste3Text, source: 'text' }]);
console.log('Teste 3 - Data inválida:');
console.log(JSON.stringify(result3, null, 2));
// Data inválida deveria resultar em dias com punches vazio
console.log('✅ Passou\n');

// Teste 4: Datas repetidas na mesma página não devem duplicar o dia
const teste4Text = `
  10/01/2024 08:00 17:00
  10/01/2024 08:00 17:00
`;

const result4 = parseCartaoPonto([{ text: teste4Text, source: 'text' }]);
console.log('Teste 4 - Datas repetidas:');
console.log(JSON.stringify(result4, null, 2));
assert(result4.pages[0].days.length === 1, 'Não deveria duplicar a mesma data repetida na mesma página');
console.log('✅ Passou\n');

console.log('✅ Todos os testes passaram!');
