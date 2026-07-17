# Plataforma de Curso Online — Novo Jeito Academy

Mapa completo de tudo que a plataforma precisa ter, organizado por área.

---

## 1. SITE PÚBLICO (página de vendas)

- **Hero** — vídeo de apresentação do curso/instrutor autoplay mudo, headline de impacto, CTA "Quero me inscrever"
- **Sobre o instrutor** — trajetória do barbeiro, autoridade, fotos de trabalhos realizados
- **O que você vai aprender** — grade curricular (módulos/aulas), com prévia de 1-2 vídeos gratuitos
- **Para quem é o curso** — perfil do aluno ideal
- **Depoimentos** — alunos formados, fotos de antes/depois de cortes
- **Galeria de fotos** — trabalhos, bastidores das aulas, estrutura
- **Certificação** — explicação do diploma/certificado ao final
- **Investimento** — preço, parcelamento, comparação (com/sem bônus), urgência (turma limitada, se for o caso)
- **Perguntas frequentes**
- **Rodapé** — contato, redes sociais, termos e política de privacidade

## 2. CADASTRO E CHECKOUT

- Formulário de cadastro (nome, e-mail, telefone, CPF — necessário p/ emissão de diploma/contrato)
- Escolha de plano (à vista / parcelado)
- Integração de pagamento (cartão, PIX, boleto)
- Aceite obrigatório dos **Termos e Contrato** via **assinatura virtual** antes de liberar o acesso
- E-mail de confirmação automático + acesso liberado após pagamento aprovado

## 3. AAssinatura Virtual (Contrato)

- Tela de contrato em texto completo, rolável
- Campo de assinatura (desenho com o dedo/mouse, captura como imagem) ou aceite com CPF + timestamp como validade jurídica simplificada
- Geração automática de PDF do contrato assinado, com data/hora/IP registrados
- Cópia enviada por e-mail ao aluno e salva na área do aluno

## 4. ÁREA DO ALUNO (depois do login)

- **Meus cursos** — módulos e aulas em vídeo, organizados em trilha
- **Player de vídeo** — com controle de progresso (% concluído por aula), marcação de aula assistida
- **Materiais de apoio** — PDFs, apostilas, links complementares por aula
- **Comunidade/Dúvidas** — espaço de perguntas por aula (opcional, pode ser fase 2)
- **Meu contrato** — visualizar/baixar o contrato assinado
- **Meu certificado/diploma** — liberado automaticamente ao concluir 100% do curso, gerado em PDF personalizado com nome do aluno, data e assinatura digital do instrutor
- **Meus dados** — editar perfil, foto, trocar senha
- **Financeiro** — status de pagamento, próximas parcelas, nota fiscal/recibo

## 5. ÁREA ADMIN (gestão completa)

### Dashboard geral
- Visão geral: nº de interessados, cadastrados, pagos, taxa de conversão, faturamento do mês

### Gestão de Leads (quem se interessou mas não comprou)
- Lista de quem cadastrou e-mail/WhatsApp mas não finalizou pagamento (captura via pop-up ou formulário de interesse na página de vendas)
- Status: Novo → Contatado → Convertido → Perdido
- Exportar lista / integrar com WhatsApp para follow-up manual

### Gestão de Alunos
- Lista completa: cadastrado, pagamento (pendente/pago/atrasado), progresso no curso (%), data de matrícula
- Filtros e busca
- Ver detalhe do aluno: dados, contrato assinado, histórico de pagamento, progresso aula a aula
- Ação manual: liberar acesso, bloquear acesso, reenviar certificado, reenviar contrato

### Gestão de Conteúdo
- Upload/organização de vídeos por módulo e aula
- Upload de materiais de apoio (PDF)
- Editor da grade curricular (adicionar/remover/reordenar aulas)

### Financeiro
- Todos os pagamentos (aprovados, pendentes, recusados, reembolsados)
- Relatório de faturamento por período
- Controle de parcelamentos em aberto

### Certificados
- Lista de certificados emitidos, reemissão manual se necessário
- Template do certificado (personalizável)

### Configurações
- Preço do curso, cupons de desconto
- Textos do contrato/termos
- Dados da empresa (para nota fiscal/diploma)

---

## Stack técnico sugerido (a decidir com você)

| Necessidade | Opções |
|---|---|
| Vídeo (hospedagem + player + progresso) | Vimeo (mais simples, player pronto) / Panda Video (BR, anti-pirataria) / self-host + Cloudflare Stream |
| Pagamento | Mercado Pago / Stripe / Asaas (bom p/ parcelamento e boleto BR) |
| Assinatura virtual | Construir simples (canvas de assinatura + PDF gerado no seu backend) ou integrar Autentique/Clicksign (mais robusto juridicamente, tem custo) |
| Geração de PDF (contrato/certificado) | Biblioteca no backend (ex: PDFKit/jsPDF), mesmo padrão que já usamos no sistema da barbearia |
| Banco/Auth | Mesmo Firebase que já usamos no sistema da barbearia — reaproveita conhecimento e pode ficar no mesmo projeto ou separado |
