/**
 * FinSight equity research console.
 *
 * Agents take different inputs, so forms are generated from a spec rather
 * than hand-written per agent: adding an agent is one entry here.
 *
 * The memo agent is chained rather than standalone -- it consumes the output
 * of filings, quant and risk, so the console caches the most recent result
 * from each and offers to feed them in.
 */
(function () {
  'use strict';

  var config = {
    apiUrl: window.FINSIGHT_API_URL || '',
    environment: window.FINSIGHT_ENV || 'dev'
  };

  var SAMPLE_EXCERPT =
    'Revenue for fiscal 2025 was $4.82 billion, up 11% year over year. ' +
    'Cloud Services revenue was $2.90 billion, up 24%. Legacy Hardware revenue ' +
    'was $1.92 billion, down 5%. Gross profit was $2.31 billion. Operating income ' +
    'was $612 million. Net income was $455 million. Total debt was $1.75 billion ' +
    'and cash and equivalents were $980 million. The Company is subject to an ' +
    'ongoing SEC inquiry regarding revenue recognition timing in its Cloud ' +
    'Services segment, and is a defendant in a patent infringement suit filed in ' +
    'March 2025. Two customers accounted for 31% of consolidated revenue.';

  var AGENTS = {
    filings: {
      title: 'Filings',
      blurb: 'Extract reported facts, quoting the supporting phrase for every figure.',
      fields: [
        { name: 'ticker', label: 'Ticker', type: 'input', required: true },
        { name: 'excerpt', label: 'Filing excerpt', type: 'textarea', rows: 8, required: true }
      ],
      example: { ticker: 'ACME', excerpt: SAMPLE_EXCERPT }
    },
    quant: {
      title: 'Quant',
      blurb: 'Compute ratios and show the arithmetic. Missing inputs are reported, not estimated.',
      fields: [
        { name: 'figures', label: 'Reported figures (JSON)', type: 'textarea', rows: 8, json: true, required: true },
        { name: 'context', label: 'Context (optional)', type: 'textarea' }
      ],
      example: {
        figures: JSON.stringify({
          revenue: '4.82B',
          gross_profit: '2.31B',
          operating_income: '612M',
          net_income: '455M',
          total_debt: '1.75B',
          cash: '980M'
        }, null, 2)
      }
    },
    risk: {
      title: 'Risk',
      blurb: 'Surface regulatory, litigation and concentration risk, evidenced by filing language.',
      fields: [
        { name: 'ticker', label: 'Ticker', type: 'input', required: true },
        { name: 'excerpt', label: 'Filing excerpt', type: 'textarea', rows: 8, required: true }
      ],
      example: { ticker: 'ACME', excerpt: SAMPLE_EXCERPT }
    },
    memo: {
      title: 'Memo',
      blurb: 'Assemble a research memo from prior analysis. Introduces no new figures.',
      chained: true,
      fields: [
        { name: 'ticker', label: 'Ticker', type: 'input', required: true }
      ],
      example: { ticker: 'ACME' }
    },
    research: {
      title: 'Auto-route',
      blurb: 'The orchestrator picks the right specialist and runs it.',
      fields: [
        { name: 'request', label: 'Request', type: 'textarea', required: true },
        { name: 'ticker', label: 'Ticker', type: 'input' },
        { name: 'excerpt', label: 'Filing excerpt (optional)', type: 'textarea', rows: 6 }
      ],
      example: {
        request: 'What risks are disclosed in this filing?',
        ticker: 'ACME',
        excerpt: SAMPLE_EXCERPT
      }
    }
  };

  // Most recent successful output per agent, used to chain into the memo.
  var cache = {};

  var current = 'filings';

  function $(id) { return document.getElementById(id); }

  function esc(s) {
    return String(s).replace(/[&<>]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c];
    });
  }

  function toast(msg, kind) {
    var t = $('toast');
    t.textContent = msg;
    t.className = 'toast show ' + (kind || 'error');
    setTimeout(function () { t.className = 'toast'; }, 3500);
  }

  function renderForm() {
    var spec = AGENTS[current];
    var html = '<div class="agent-head"><h2>' + spec.title + '</h2><p>' + spec.blurb + '</p></div>';

    if (spec.chained) {
      var have = ['filings', 'quant', 'risk'].filter(function (k) { return cache[k]; });
      html += '<div class="chain-status">' +
        (have.length
          ? 'Will include cached output from: <strong>' + have.join(', ') + '</strong>'
          : 'No prior analysis cached yet. Run Filings, Quant and Risk first for a grounded memo.') +
        '</div>';
    }

    spec.fields.forEach(function (f) {
      var req = f.required ? ' <span class="req">required</span>' : '';
      var el = f.type === 'input'
        ? '<input id="f-' + f.name + '" type="text">'
        : '<textarea id="f-' + f.name + '" rows="' + (f.rows || 4) + '"></textarea>';
      html += '<label for="f-' + f.name + '">' + f.label + req + '</label>' + el;
    });

    $('fields').innerHTML = html;

    $('examples').innerHTML = '<button type="button" class="example-btn" id="load-example">Load example filing</button>';
    $('load-example').addEventListener('click', function () {
      Object.keys(spec.example).forEach(function (k) {
        var el = $('f-' + k);
        if (el) el.value = spec.example[k];
      });
    });
  }

  function collect() {
    var spec = AGENTS[current];
    var body = {};

    for (var i = 0; i < spec.fields.length; i++) {
      var f = spec.fields[i];
      var el = $('f-' + f.name);
      if (!el) continue;

      var raw = el.value.trim();
      if (!raw) {
        if (f.required) throw new Error(f.label + ' is required');
        continue;
      }

      if (f.json) {
        try {
          body[f.name] = JSON.parse(raw);
        } catch (e) {
          throw new Error(f.label + ' must be valid JSON');
        }
      } else {
        body[f.name] = raw;
      }
    }

    if (spec.chained) {
      ['filings', 'quant', 'risk'].forEach(function (k) {
        if (cache[k]) body[k] = cache[k];
      });
    }
    return body;
  }

  function renderResult(data, ms) {
    var result = (data && data.result) || data || {};
    var payload = result.output || result;
    var html = '<div class="result-meta">' + ms + ' ms</div>';

    if (result.routed_to) {
      html += '<div class="routed">routed to <strong>' + esc(result.routed_to) + '</strong></div>';
    }

    if (payload.headline) {
      html += '<div class="headline">' + esc(payload.headline) + '</div>';
    }
    if (payload.summary) {
      html += '<section><h4>summary</h4><p>' + esc(payload.summary) + '</p></section>';
    }
    if (payload.period) {
      html += '<section><h4>period</h4><p>' + esc(payload.period) + '</p></section>';
    }

    // Key figures / segment results: value plus the quote backing it.
    ['key_figures', 'segment_results'].forEach(function (key) {
      var rows = payload[key];
      if (!Array.isArray(rows) || !rows.length) return;
      html += '<section><h4>' + key.replace(/_/g, ' ') + '</h4><table class="grid">';
      rows.forEach(function (r) {
        html += '<tr><td class="k">' + esc(r.name || r.metric || '') + '</td>' +
                '<td class="v">' + esc(r.value || '') + '</td>' +
                '<td class="q">' + esc(r.quote || '') + '</td></tr>';
      });
      html += '</table></section>';
    });

    if (Array.isArray(payload.ratios) && payload.ratios.length) {
      html += '<section><h4>ratios</h4><table class="grid">';
      payload.ratios.forEach(function (r) {
        html += '<tr><td class="k">' + esc(r.name) + '</td>' +
                '<td class="v">' + esc(r.value) + '</td>' +
                '<td class="q">' + esc(r.workings || r.interpretation || '') + '</td></tr>';
      });
      html += '</table></section>';
    }

    if (Array.isArray(payload.not_computable) && payload.not_computable.length) {
      html += '<section><h4>not computable</h4><ul>';
      payload.not_computable.forEach(function (r) {
        html += '<li>' + esc(r.name) + ' &mdash; missing ' + esc(r.missing_input || 'input') + '</li>';
      });
      html += '</ul></section>';
    }

    if (Array.isArray(payload.risks) && payload.risks.length) {
      html += '<section><h4>risks</h4>';
      payload.risks.forEach(function (r) {
        html += '<div class="risk">' +
          '<span class="sev sev-' + esc(r.severity || 'low') + '">' + esc(r.severity || '') + '</span>' +
          '<span class="cat">' + esc(r.category || '') + '</span>' +
          '<p>' + esc(r.description || '') + '</p>' +
          (r.evidence ? '<blockquote>' + esc(r.evidence) + '</blockquote>' : '') +
          '</div>';
      });
      html += '</section>';
    }

    ['supporting_points', 'open_questions', 'observations',
     'not_disclosed', 'disclosure_gaps', 'management_commentary'].forEach(function (key) {
      var v = payload[key];
      if (Array.isArray(v) && v.length) {
        html += '<section><h4>' + key.replace(/_/g, ' ') + '</h4><ul>';
        v.forEach(function (x) {
          html += '<li>' + esc(typeof x === 'string' ? x : JSON.stringify(x)) + '</li>';
        });
        html += '</ul></section>';
      }
    });

    if (payload.memo) {
      html += '<section><h4>memo</h4><p class="memo">' + esc(payload.memo) + '</p></section>';
    }
    if (payload.disclaimer) {
      html += '<div class="disclaimer">' + esc(payload.disclaimer) + '</div>';
    }

    html += '<details class="raw"><summary>Raw response</summary><pre>' +
            esc(JSON.stringify(data, null, 2)) + '</pre></details>';

    $('output').innerHTML = html;
  }

  function submit(ev) {
    ev.preventDefault();

    if (!config.apiUrl) {
      toast('API URL not configured');
      return;
    }

    var body;
    try {
      body = collect();
    } catch (e) {
      toast(e.message);
      return;
    }

    var agent = current;
    var btn = $('run-btn');
    btn.disabled = true;
    btn.textContent = 'Running...';
    var started = performance.now();

    fetch(config.apiUrl + '/v1/' + agent, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
      .then(function (res) {
        return res.json().then(function (data) {
          return { ok: res.ok, status: res.status, data: data };
        });
      })
      .then(function (r) {
        var ms = Math.round(performance.now() - started);
        if (!r.ok) throw new Error(r.data.message || ('HTTP ' + r.status));
        var result = (r.data && r.data.result) || r.data;
        if (['filings', 'quant', 'risk'].indexOf(agent) !== -1) {
          cache[agent] = result;
        }
        $('latency').textContent = ms + ' ms';
        renderResult(r.data, ms);
      })
      .catch(function (e) {
        toast(e.message);
        $('output').innerHTML = '<div class="empty"><h3>Request failed</h3><p>' +
                                esc(e.message) + '</p></div>';
      })
      .then(function () {
        btn.disabled = false;
        btn.textContent = 'Run';
      });
  }

  var buttons = document.querySelectorAll('.agent-btn');
  for (var i = 0; i < buttons.length; i++) {
    buttons[i].addEventListener('click', function (ev) {
      for (var j = 0; j < buttons.length; j++) buttons[j].classList.remove('active');
      ev.currentTarget.classList.add('active');
      current = ev.currentTarget.getAttribute('data-agent');
      renderForm();
      $('output').innerHTML = '<div class="empty"><h3>' + AGENTS[current].title +
        '</h3><p>' + AGENTS[current].blurb + '</p></div>';
    });
  }

  $('agent-form').addEventListener('submit', submit);
  $('env-badge').textContent = config.environment;
  renderForm();
})();
