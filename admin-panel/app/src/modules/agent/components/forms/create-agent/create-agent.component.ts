import {
  Component,
  ChangeDetectorRef,
  EventEmitter,
  Output,
  Input,
  SimpleChange,
  ViewChild,
  TemplateRef
} from '@angular/core';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { PostCallAnalysis } from '../post-call-analysis-form/post-call-analysis-modal.component';

@Component({
  selector: 'app-create-agent',
  templateUrl: './create-agent.component.html',
  styleUrl: './create-agent.component.scss'
})
export class CreateAgentComponent {
  @ViewChild('postCallAnalysisModal') postCallAnalysisModal!: TemplateRef<any>;
  @Output() createAgent = new EventEmitter<any>();
  @Output() updateAgent = new EventEmitter<any>();
  @Input() selectedAgentData: any;
  @Input() modalMode: 'details' | 'update' = 'details';
  selectedTab = 'phone';
  expandedIndexBond: number | null = null;
  isCreating = false;
  agentForm!: FormGroup;
  editingIndex: number | null = null;
  currentAnalysis: PostCallAnalysis = { name: '', description: '', examples: [], type: '', required: false };
  postCallModalRef: NgbModalRef | null = null;
  expandedPostCallIndex: number | null = null;
  constructor(
    private _modalService: NgbModal,
    private cdr: ChangeDetectorRef,
    private fb: FormBuilder
  ) {
    this.setValueInForm();
  }

  public ngOnChanges(changes: { [propKey: string]: SimpleChange }): void {
    if ('selectedAgentData' in changes) {
      this.selectedAgentData = changes['selectedAgentData'].currentValue;
    }

    if ('modalMode' in changes) {
      this.modalMode = changes['modalMode'].currentValue;
    }
    this.setValueInForm();
  }

  setValueInForm() {
    this.agentForm = this.fb.group({
      id: [this.selectedAgentData?._id || null],
      agentName: [
        this.selectedAgentData?.agentName || null,
        [Validators.required, Validators.minLength(3), Validators.maxLength(50)]
      ],
      firstMessage: [
        this.selectedAgentData?.firstMessage || null,
        [Validators.required]
      ],
      systemPrompt: [
        this.selectedAgentData?.systemPrompt
          ? this.selectedAgentData.systemPrompt
          : (this.selectedAgentData?.agentPrompt || null),
        [Validators.required, Validators.minLength(1)]
      ]
    });
    if (this.selectedAgentData) {
      this.selectedAgentData = {
        ...this.selectedAgentData,
        postCallAnalysisData: [...(this.selectedAgentData.postCallAnalysisData || [])]
      };
    }
    this.updateFormState();
  }

  updateFormState() {
    if (this.agentForm) {
      if (this.modalMode === 'details') {
        this.agentForm.get('agentName')?.disable();
        this.agentForm.get('firstMessage')?.disable();
        this.agentForm.get('systemPrompt')?.disable();
      } else {
        this.agentForm.get('agentName')?.enable();
        this.agentForm.get('firstMessage')?.enable();
        this.agentForm.get('systemPrompt')?.enable();
      }
    }
  }

  close() {
    this.resetData();
    this._modalService.dismissAll();
  }

  resetData() {
    this.agentForm.reset({
      id: null,
      agentName: null,
      firstMessage: null,
      systemPrompt: null
    });

    this.editingIndex = null;
    this.currentAnalysis = { name: '', description: '', examples: [], type: '', required: false };
    this.postCallModalRef = null;
    this.selectedTab = 'phone';
    this.expandedIndexBond = null;
    this.selectedAgentData = { postCallAnalysisData: [] };
    this.modalMode = 'details';
  }

  get isReadonly(): boolean {
    return this.modalMode === 'details';
  }

  // Check if form is editable
  get isEditable(): boolean {
    return this.modalMode === 'update';
  }

  get modalTitle(): string {
    switch (this.modalMode) {
      case 'details':
        return 'Agent Details';
      case 'update':
        return 'Update Agent';
    }
  }

  get hasInboundPhone(): boolean {
    return (
      this.selectedAgentData?.phoneBindings?.some((phone: any) => phone.direction === 'inbound') ||
      false
    );
  }

  get hasOutboundPhone(): boolean {
    return (
      this.selectedAgentData?.phoneBindings?.some((phone: any) => phone.direction === 'outbound') ||
      false
    );
  }

  getPhoneNumberByDirection(direction: string): string {
    const phone = this.selectedAgentData?.phoneBindings?.find(
      (phone: any) => phone.direction === direction
    );
    return phone?.number || '';
  }

  onEditPostCallAnalysis(i: number) {
    this.editingIndex = i;
    this.currentAnalysis = { ...this.selectedAgentData.postCallAnalysisData[i] };
    this.postCallModalRef = this._modalService.open(this.postCallAnalysisModal, {
      centered: true,
      size: 'md',
      backdrop: 'static'
    });
  }

  onDeletePostCallAnalysis(index: number) {
    this.selectedAgentData.postCallAnalysisData.splice(index, 1);
  }

  onAddPostCallAnalysis() {
    this.editingIndex = null;
    this.currentAnalysis = { name: '', description: '', examples: [], type: '', required: false };
    this.postCallModalRef = this._modalService.open(this.postCallAnalysisModal, {
      centered: true,
      size: 'md',
      backdrop: 'static'
    });
  }

  handleSave(event: { data: PostCallAnalysis; index: number | null }) {
    if (event.index !== null) {
      this.selectedAgentData.postCallAnalysisData[event.index] = event.data;
    } else {
      // Initialize postCallAnalysisData if it doesn't exist
      if (!this.selectedAgentData.postCallAnalysisData) {
        this.selectedAgentData.postCallAnalysisData = [];
      }
      this.selectedAgentData.postCallAnalysisData.push(event.data);
    }
    if (this.postCallModalRef) {
      this.postCallModalRef.close();
      this.postCallModalRef = null;
    }
  }

  handleClose() {
    if (this.postCallModalRef) {
      this.postCallModalRef.dismiss();
      this.postCallModalRef = null;
    }
  }

  onUpdate() {
    if (this.agentForm.valid) {
      const payload = {
        agentName: this.agentForm.get('agentName')?.value,
        firstMessage: this.agentForm.get('firstMessage')?.value,
        systemPrompt: this.agentForm.get('systemPrompt')?.value,
        postCallAnalysisData: this.selectedAgentData?.postCallAnalysisData || []
      };

      this.updateAgent.emit({
        id: this.agentForm.get('id')?.value,
        payload
      });
    } else {
      this.agentForm.markAllAsTouched();
    }
  }
}
