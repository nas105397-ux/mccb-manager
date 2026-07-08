export const STATUS_MESSAGE_KEYS = {
  REQUEST_ISSUED: 'requestIssued',
  REQUEST_RECEIPT_SENT: 'requestReceiptSent',
  REQUEST_DRAFT_SAVED: 'requestDraftSaved',
  REQUEST_LIST_RECEIPT_SENT: 'requestListReceiptSent',
  REQUEST_TARGETS_ADDED: 'requestTargetsAdded',
  REQUEST_TARGET_CARD_UPDATED: 'requestTargetCardUpdated',
  DRAFT_REQUEST_ISSUED: 'draftRequestIssued',
  MASTER_UPDATED: 'masterUpdated',
  TEMPORARY_RETURN_CARD_BORROWED: 'temporaryReturnCardBorrowed',
};

const STATUS_MESSAGE_DEFINITIONS = {
  [STATUS_MESSAGE_KEYS.REQUEST_ISSUED]: {
    type: 'success',
    text: '停電依頼を発行し、一覧へ登録しました。',
  },
  [STATUS_MESSAGE_KEYS.REQUEST_RECEIPT_SENT]: {
    type: 'success',
    text: '停電依頼を発行し、スター精密プリンターへ依頼表を送信しました。',
  },
  [STATUS_MESSAGE_KEYS.REQUEST_DRAFT_SAVED]: {
    type: 'success',
    text: '停電依頼を仮発行し、仮発行一覧へ登録しました。',
  },
  [STATUS_MESSAGE_KEYS.REQUEST_LIST_RECEIPT_SENT]: {
    type: 'success',
    text: 'スター精密プリンターへ依頼表を送信しました。',
  },
  [STATUS_MESSAGE_KEYS.REQUEST_TARGETS_ADDED]: {
    type: 'success',
    text: '選択した設備を依頼に追加しました。',
  },
  [STATUS_MESSAGE_KEYS.REQUEST_TARGET_CARD_UPDATED]: {
    type: 'success',
    text: ({ targetName, actionLabel }) =>
      `${targetName} の子札を${actionLabel}しました。`,
  },
  [STATUS_MESSAGE_KEYS.DRAFT_REQUEST_ISSUED]: {
    type: 'success',
    text: '仮発行依頼を発行しました。',
  },
  [STATUS_MESSAGE_KEYS.MASTER_UPDATED]: {
    type: 'success',
    text: '設備情報を更新しました。',
  },
  [STATUS_MESSAGE_KEYS.TEMPORARY_RETURN_CARD_BORROWED]: {
    type: 'success',
    text: ({ workerName, cardId }) =>
      `${workerName}氏へ子札 No.${cardId} を再貸出しました。`,
  },
};

export const createStatusMessage = (key, params = {}) => {
  const definition = STATUS_MESSAGE_DEFINITIONS[key];
  if (!definition) return null;

  return {
    type: definition.type,
    text:
      typeof definition.text === 'function'
        ? definition.text(params)
        : definition.text,
  };
};
