(function(){
  var nav=document.getElementById('siteNav');
  var sp=document.getElementById('scrollProgress');
  var btt=document.getElementById('backToTop');

  window.addEventListener('scroll',function(){
    var s=window.scrollY;
    var d=document.documentElement.scrollHeight-window.innerHeight;
    sp.style.width=(s/d*100)+'%';
    nav.classList.toggle('scrolled',s>60);
    btt.classList.toggle('visible',s>500);
  },{passive:true});

  btt.addEventListener('click',function(){window.scrollTo({top:0,behavior:'smooth'})});

  var navToggle=document.getElementById('navToggle');
  var navLinks=document.getElementById('navLinks');
  navToggle.addEventListener('click',function(){
    var o=navLinks.classList.toggle('open');
    navToggle.classList.toggle('active',o);
    navToggle.setAttribute('aria-expanded',o);
  });
  navLinks.querySelectorAll('a').forEach(function(a){
    a.addEventListener('click',function(){
      navLinks.classList.remove('open');
      navToggle.classList.remove('active');
      navToggle.setAttribute('aria-expanded',false);
    });
  });

  document.getElementById('year').textContent=new Date().getFullYear();

  var DOW_ABBR=['dom','lun','mar','mi\u00e9','ju\u00e9','vie','s\u00e1b'];
  var MONTH_ABBR=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

  function slotsForDow(d){
    if(d===0) return [];
    if(d===6) return ['8:00 a.m.','9:00 a.m.','10:00 a.m.','11:00 a.m.'];
    return ['8:00 a.m.','9:00 a.m.','10:00 a.m.','11:00 a.m.','2:00 p.m.','3:00 p.m.','4:00 p.m.','5:00 p.m.'];
  }

  function generateDates(n){
    var out=[];
    var d=new Date();
    d.setHours(0,0,0,0);
    d.setDate(d.getDate()+1);
    while(out.length<n){
      var dow=d.getDay();
      out.push({date:new Date(d),dow:dow,closed:dow===0});
      d.setDate(d.getDate()+1);
    }
    return out;
  }

  function longDate(d){
    var days=['domingo','lunes','martes','mi\u00e9rcoles','jueves','viernes','s\u00e1bado'];
    var months=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    return days[d.getDay()]+' '+d.getDate()+' de '+months[d.getMonth()]+' de '+d.getFullYear();
  }

  fetch('/api/citas/proxima').then(function(r){return r.json()}).then(function(cita){
    if(cita){
      var d=new Date(cita.fecha+'T12:00:00');
      document.getElementById('nextAvailable').textContent=DOW_ABBR[d.getDay()]+' '+d.getDate()+' '+MONTH_ABBR[d.getMonth()];
    } else {
      var dates=generateDates(7);
      var first=dates.find(function(d){return !d.closed});
      if(first) document.getElementById('nextAvailable').textContent=DOW_ABBR[first.dow]+' '+first.date.getDate()+' '+MONTH_ABBR[first.date.getMonth()];
    }
  }).catch(function(){
    var dates=generateDates(7);
    var first=dates.find(function(d){return !d.closed});
    if(first) document.getElementById('nextAvailable').textContent=DOW_ABBR[first.dow]+' '+first.date.getDate()+' '+MONTH_ABBR[first.date.getMonth()];
  });

  var state={plan:null,planLabel:null,planPrice:null,date:null,dateLabel:null,time:null,nombre:'',negocio:'',telefono:'',correo:'',notas:''};
  var currentStep=1;
  var TOTAL_STEPS=4;

  var wizardBody=document.querySelectorAll('.wstepbody');
  var wizardProgress=document.querySelectorAll('.wstep');
  var backBtn=document.getElementById('backBtn');
  var nextBtn=document.getElementById('nextBtn');
  var stepHint=document.getElementById('stepHint');

  var PLAN_META={
    basico:{label:'Plan B\u00e1sico',price:'$250.000 COP'},
    personalizado:{label:'Plan Personalizado',price:'$400.000 COP'},
    soporte:{label:'Solo soporte',price:'Por definir'}
  };

  function setPlan(k){
    state.plan=k;
    state.planLabel=PLAN_META[k].label;
    state.planPrice=PLAN_META[k].price;
    document.querySelectorAll('.plan-choice').forEach(function(b){
      b.setAttribute('aria-pressed',b.dataset.plan===k?'true':'false');
    });
  }

  document.querySelectorAll('.plan-choice').forEach(function(btn){
    btn.addEventListener('click',function(){setPlan(btn.dataset.plan)});
  });

  document.querySelectorAll('.plan-select').forEach(function(btn){
    btn.addEventListener('click',function(){
      setPlan(btn.dataset.plan);
      goToStep(1);
      document.getElementById('agendar').scrollIntoView({behavior:'smooth'});
    });
  });

  var dateStrip=document.getElementById('dateStrip');
  var timeGrid=document.getElementById('timeGrid');
  var allDates=generateDates(14);
  var ocupadas=[];

  function formatDateKey(d){
    var y=d.getFullYear();
    var m=String(d.getMonth()+1).padStart(2,'0');
    var day=String(d.getDate()).padStart(2,'0');
    return y+'-'+m+'-'+day;
  }

  function getOcupadasForDate(dateKey){
    return ocupadas.filter(function(o){return o.fecha===dateKey}).map(function(o){return o.hora});
  }

  function loadOcupadas(){
    fetch('/api/citas/ocupadas').then(function(r){return r.json()}).then(function(data){
      ocupadas=data||[];
      renderDateIndicators();
    }).catch(function(){ocupadas=[]});
  }

  function renderDateIndicators(){
    document.querySelectorAll('.date-chip').forEach(function(chip){
      var key=chip.dataset.dateKey;
      if(!key) return;
      var existing=chip.querySelector('.dc-occupied');
      if(existing) existing.remove();
      var taken=getOcupadasForDate(key);
      if(taken.length>0){
        var dot=document.createElement('div');
        dot.className='dc-occupied';
        dot.textContent=taken.length+' ocupado'+(taken.length>1?'s':'');
        chip.appendChild(dot);
      }
    });
  }

  allDates.forEach(function(d){
    var chip=document.createElement('button');
    chip.className='date-chip';
    chip.setAttribute('aria-pressed','false');
    chip.dataset.dateKey=formatDateKey(d.date);
    chip.innerHTML='<div class="dc-day">'+DOW_ABBR[d.dow]+'</div><div class="dc-num">'+d.date.getDate()+'</div><div class="dc-month">'+MONTH_ABBR[d.date.getMonth()]+'</div>';
    if(d.closed){
      chip.disabled=true;
      chip.title='Cerrado los domingos';
    } else {
      chip.addEventListener('click',function(){selectDate(d,chip)});
    }
    dateStrip.appendChild(chip);
  });

  loadOcupadas();

  function selectDate(d,el){
    state.date=d.date;
    state.dateLabel=longDate(d.date);
    document.querySelectorAll('.date-chip').forEach(function(c){c.setAttribute('aria-pressed','false')});
    el.setAttribute('aria-pressed','true');
    renderTimeSlots(d.dow,formatDateKey(d.date));
  }

  function renderTimeSlots(dow,dateKey){
    timeGrid.innerHTML='';
    state.time=null;
    var taken=getOcupadasForDate(dateKey);
    slotsForDow(dow).forEach(function(t){
      var chip=document.createElement('button');
      chip.className='time-chip';
      var isOcupado=taken.indexOf(t)!==-1;
      if(isOcupado){
        chip.classList.add('ocupado');
        chip.title='Horario ya reservado';
      }
      chip.setAttribute('aria-pressed','false');
      chip.textContent=t+(isOcupado?' ✕':'');
      if(!isOcupado){
        chip.addEventListener('click',function(){
          state.time=t;
          document.querySelectorAll('.time-chip').forEach(function(c){c.setAttribute('aria-pressed','false')});
          chip.setAttribute('aria-pressed','true');
        });
      }
      timeGrid.appendChild(chip);
    });
    if(taken.length>0){
      var note=document.createElement('p');
      note.className='time-note';
      note.style.color='var(--danger)';
      note.textContent='* '+taken.length+' horario'+(taken.length>1?'s':'')+' ya reservado'+(taken.length>1?'s':'')+' para este día.';
      timeGrid.parentElement.appendChild(note);
    }
  }

  var fNombre=document.getElementById('fNombre');
  var fNegocio=document.getElementById('fNegocio');
  var fTel=document.getElementById('fTel');
  var fCorreo=document.getElementById('fCorreo');
  var fNotas=document.getElementById('fNotas');

  function goToStep(n){
    currentStep=n;
    wizardBody.forEach(function(b){b.classList.toggle('active',Number(b.dataset.step)===n)});
    wizardProgress.forEach(function(p){
      var s=Number(p.dataset.step);
      p.classList.toggle('active',s===n);
      p.classList.toggle('done',s<n);
    });
    backBtn.style.visibility=n===1?'hidden':'visible';
    nextBtn.textContent=n===TOTAL_STEPS?'Listo':'Siguiente';
    nextBtn.style.display=n===TOTAL_STEPS?'none':'inline-flex';
    stepHint.textContent='Paso '+n+' de '+TOTAL_STEPS;
    if(n===4) renderSummary();
  }

  function clearInvalid(){
    ['fNombreWrap','fNegocioWrap','fTelWrap'].forEach(function(id){
      document.getElementById(id).classList.remove('invalid');
    });
  }

  function validateStep(){
    if(currentStep===1){
      if(!state.plan){alert('Elige un plan para continuar.');return false}
    }
    if(currentStep===2){
      if(!state.date||!state.time){alert('Elige una fecha y un horario para continuar.');return false}
    }
    if(currentStep===3){
      clearInvalid();
      var ok=true;
      if(!fNombre.value.trim()){document.getElementById('fNombreWrap').classList.add('invalid');ok=false}
      if(!fNegocio.value.trim()){document.getElementById('fNegocioWrap').classList.add('invalid');ok=false}
      if(!fTel.value.trim()){document.getElementById('fTelWrap').classList.add('invalid');ok=false}
      if(!ok) return false;
      state.nombre=fNombre.value.trim();
      state.negocio=fNegocio.value.trim();
      state.telefono=fTel.value.trim();
      state.correo=fCorreo.value.trim();
      state.notas=fNotas.value.trim();
    }
    return true;
  }

  nextBtn.addEventListener('click',function(){
    if(!validateStep()) return;
    if(currentStep<TOTAL_STEPS) goToStep(currentStep+1);
  });
  backBtn.addEventListener('click',function(){if(currentStep>1) goToStep(currentStep-1)});

  function renderSummary(){
    var card=document.getElementById('summaryCard');
    var rows=[
      ['Plan',state.planLabel||'\u2014'],
      ['Fecha',state.dateLabel||'\u2014'],
      ['Hora',state.time||'\u2014'],
      ['Nombre',state.nombre||'\u2014'],
      ['Negocio',state.negocio||'\u2014'],
      ['Tel\u00e9fono',state.telefono||'\u2014']
    ];
    if(state.notas) rows.push(['Notas',state.notas]);
    card.innerHTML=rows.map(function(r){
      return '<div class="summary-row"><span class="sk">'+r[0]+'</span><span class="sv">'+r[1]+'</span></div>';
    }).join('');
  }

  document.getElementById('confirmBtn').addEventListener('click',async function(){
    var btn=document.getElementById('confirmBtn');
    btn.disabled=true;
    btn.textContent='Enviando...';
    try {
      var r=await fetch('/api/citas',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          nombre:state.nombre,negocio:state.negocio,telefono:state.telefono,
          correo:state.correo,plan:state.plan,
          fecha:state.date.toISOString().slice(0,10),hora:state.time,notas:state.notas
        })
      });
      if(!r.ok){
        var err=await r.json();
        alert(err.error||'Error al agendar.');
        btn.disabled=false;
        btn.textContent='Confirmar y enviar por WhatsApp';
        return;
      }
      var lines=[
        'Hola Lopez Tech, quiero agendar una cita:',
        'Plan: '+state.planLabel,'Fecha: '+state.dateLabel,'Hora: '+state.time,
        'Nombre: '+state.nombre,'Negocio: '+state.negocio,'Tel\u00e9fono: '+state.telefono
      ];
      if(state.correo) lines.push('Correo: '+state.correo);
      if(state.notas) lines.push('Notas: '+state.notas);
      window.open('https://wa.me/573235538178?text='+encodeURIComponent(lines.join('\n')),'_blank');
      document.getElementById('confirmView').style.display='none';
      document.getElementById('successPanel').classList.add('show');
    } catch(e) {
      alert('Error de conexi\u00f3n.');
      btn.disabled=false;
      btn.textContent='Confirmar y enviar por WhatsApp';
    }
  });

  document.getElementById('resetBtn').addEventListener('click',function(){
    state.plan=state.planLabel=state.planPrice=state.date=state.dateLabel=state.time=null;
    state.nombre=state.negocio=state.telefono=state.correo=state.notas='';
    fNombre.value=fNegocio.value=fTel.value=fCorreo.value=fNotas.value='';
    document.querySelectorAll('.plan-choice').forEach(function(b){b.setAttribute('aria-pressed','false')});
    document.querySelectorAll('.date-chip').forEach(function(c){c.setAttribute('aria-pressed','false')});
    timeGrid.innerHTML='';
    document.getElementById('confirmView').style.display='';
    document.getElementById('successPanel').classList.remove('show');
    goToStep(1);
  });

  goToStep(1);

  var observer=new IntersectionObserver(function(entries){
    entries.forEach(function(e){
      if(e.isIntersecting){
        e.target.classList.add('visible');
        if(e.target.classList.contains('stagger-child')){
          var siblings=[].concat(Array.from(e.target.parentElement.children));
          siblings.forEach(function(s,i){
            setTimeout(function(){s.classList.add('visible')},i*100);
          });
        }
      }
    });
  },{threshold:0.15,rootMargin:'0px 0px -40px 0px'});

  document.querySelectorAll('.reveal,.reveal-left,.reveal-right,.reveal-scale,.stagger-child').forEach(function(el){
    observer.observe(el);
  });

  var countObserver=new IntersectionObserver(function(entries){
    entries.forEach(function(e){
      if(e.isIntersecting){
        var el=e.target;
        var target=parseInt(el.dataset.count);
        var current=0;
        var step=Math.max(1,Math.floor(target/40));
        var timer=setInterval(function(){
          current+=step;
          if(current>=target){current=target;clearInterval(timer)}
          el.textContent=current;
        },30);
        countObserver.unobserve(el);
      }
    });
  },{threshold:0.5});

  document.querySelectorAll('.stat-number[data-count]').forEach(function(el){
    countObserver.observe(el);
  });

  document.querySelectorAll('.faq-q').forEach(function(btn){
    btn.addEventListener('click',function(){
      var item=btn.parentElement;
      var wasOpen=item.classList.contains('open');
      document.querySelectorAll('.faq-item.open').forEach(function(i){i.classList.remove('open')});
      if(!wasOpen) item.classList.add('open');
    });
  });

})();
