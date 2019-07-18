const DomUtils = {
  getEl: (selector) => window.document.querySelector(selector),

  hasClass: (el, cssClass) => {
    if (el.classList) {
      return el.classList.contains(cssClass);
    }
    return !!el.className.match(new RegExp(`(\\s|^)${cssClass}(\\s|$)`));
  },

  removeClass: (el, cssClass) => {
    if (el.classList) {
      el.classList.remove(cssClass);
    } else if (DomUtils.hasClass(el, cssClass)) {
      const reg = new RegExp(`(\\s|^)${cssClass}(\\s|$)`);
      el.className = el.className.replace(reg, ' ');
    }
  },
};

const SubmitButton = {
  buttonElement: DomUtils.getEl('[data-submit-btn]'),
  loaderElement: DomUtils.getEl('.btn__loader'),

  enable: () => {
    SubmitButton.buttonElement.disabled = false;
    DomUtils.removeClass(SubmitButton.buttonElement, 'disabled-bkg');
  },

  setSubmitState: () => {
    SubmitButton.buttonElement.disabled = true;
    SubmitButton.loaderElement.style.display = 'inline-block';
  },

  removeSubmitState: () => {
    SubmitButton.buttonElement.disabled = false;
    SubmitButton.loaderElement.style.display = 'none';
  }
};

const config = {
  fields: {
    card: {
      selector: '[data-cc-card]',
    },
    cvv: {
      selector: '[data-cc-cvv]',
    },
    exp: {
      selector: '[data-cc-exp]',
    },
    name: {
      selector: '[data-cc-name]',
      placeholder: 'Full Name',
    },
  },

  styles: {
    input: {
      'font-size': '16px',
      color: '#00a9e0',
      'font-family': 'monospace',
      background: 'black',
    },
    '.card': {
      'font-family': 'monospace',
    },
    ':focus': {
      color: '#00a9e0',
    },
    '.valid': {
      color: '#43B02A',
    },
    '.invalid': {
      color: '#C01324',
    },
    '@media screen and (max-width: 700px)': {
      input: {
        'font-size': '18px',
      },
    },
    'input:-webkit-autofill': {
      '-webkit-box-shadow': '0 0 0 50px white inset',
    },
    'input:focus:-webkit-autofill': {
      '-webkit-text-fill-color': '#00a9e0',
    },
    'input.valid:-webkit-autofill': {
      '-webkit-text-fill-color': '#43B02A',
    },
    'input.invalid:-webkit-autofill': {
      '-webkit-text-fill-color': '#C01324',
    },
    'input::placeholder': {
      color: '#aaa',
    },
  },

  classes: {
    empty: 'empty',
    focus: 'focus',
    invalid: 'invalid',
    valid: 'valid',
  },
};

function authorizeSession(callback) {
  let request = new XMLHttpRequest();
  request.onload = () => {
    if (request.status >= 200 && request.status < 300) {
      callback(JSON.parse(request.responseText));
    } else {
      throw new Error("error response: " + request.responseText);
    }
    request = null;
  };

  request.open("POST", "/api/authorize-session", true);
  request.send();
}

const hooks = {
  preFlowHook: authorizeSession,
};

const onCreate = (paymentForm) => {
  const onSuccess = (clientToken) => {
    console.log("submit success; clientToken=\""+clientToken+"\"");
    alert("Tokenization request sent!\nCheck your webhook for results using clientToken.\n\nclientToken=\""+clientToken+"\" (also available in console)");
    SubmitButton.removeSubmitState();
    paymentForm.reset(() => {});
  };

  const onError = (error) => {
    console.log("Tokenize Error: " + error.message());
    alert("Tokenization request error: \"" + error.message() + "\"");
    SubmitButton.removeSubmitState();
    paymentForm.reset(() => {});
  };
  const form = DomUtils.getEl('#form')
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    SubmitButton.setSubmitState();
    paymentForm.onSubmit(onSuccess, onError);
  });

  const ccFields = window.document.getElementsByClassName('payment-fields');
  for (let i = 0; i < ccFields.length; i++) {
    DomUtils.removeClass(ccFields[i], 'disabled');
  }
  SubmitButton.enable();
};

window.firstdata.createPaymentForm(config, hooks, onCreate);

